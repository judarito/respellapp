import 'dotenv/config'
import crypto from 'node:crypto'
import http from 'node:http'
import { createClient } from '@libsql/client'
import {
  SESSION_COOKIE,
  SESSION_DURATION_DAYS,
  addDays,
  generateSessionToken,
  hashSessionToken,
  normalizeEmail,
  parseCookies,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  verifyPassword,
} from './auth.js'

const port = Number(process.env.PORT || 3001)
const tursoUrl = process.env.TURSO_URL
const tursoToken = process.env.TURSO_TOKEN
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET
const cloudinaryUploadFolder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'respell'
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const allowedCourseModalities = new Set(['virtual', 'presential', 'mixed'])
const allowedCourseStatuses = new Set(['draft', 'published', 'archived'])
const allowedCohortStatuses = new Set(['draft', 'published', 'closed', 'cancelled'])
const allowedEnrollmentStatuses = new Set([
  'pending',
  'confirmed',
  'waitlist',
  'cancelled',
  'rejected',
])
const maxJsonBodySize = 20_000_000

if (!tursoUrl || !tursoToken) {
  throw new Error('Missing TURSO_URL or TURSO_TOKEN in environment variables.')
}

const db = createClient({
  url: tursoUrl,
  authToken: tursoToken,
})

async function ensureTableColumn(tableName, columnName, alterStatement) {
  const result = await db.execute(`PRAGMA table_info(${tableName})`)
  const hasColumn = result.rows.some((column) => column.name === columnName)

  if (!hasColumn) {
    await db.execute(alterStatement)
  }
}

async function ensureSchema() {
  await db.execute('PRAGMA foreign_keys = ON')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS contact_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'landing-page',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await ensureTableColumn(
    'users',
    'role',
    "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'",
  )
  await db.execute("UPDATE users SET role = 'admin' WHERE role IS NULL OR trim(role) = ''")

  await ensureTableColumn(
    'sessions',
    'last_seen_at',
    'ALTER TABLE sessions ADD COLUMN last_seen_at TEXT',
  )
  await db.execute(`
    UPDATE sessions
    SET last_seen_at = COALESCE(last_seen_at, created_at, CURRENT_TIMESTAMP)
    WHERE last_seen_at IS NULL
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS course_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_description TEXT,
      description TEXT,
      learning_objectives TEXT,
      target_audience TEXT,
      modality TEXT NOT NULL DEFAULT 'mixed',
      level TEXT NOT NULL DEFAULT 'all',
      duration_hours INTEGER NOT NULL DEFAULT 0,
      cover_image_url TEXT,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'COP',
      publication_status TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES course_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CHECK (modality IN ('virtual', 'presential', 'mixed')),
      CHECK (publication_status IN ('draft', 'published', 'archived')),
      CHECK (duration_hours >= 0),
      CHECK (price_cents >= 0)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS course_cohorts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      title TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      enrollment_open_at TEXT,
      enrollment_close_at TEXT,
      capacity INTEGER,
      seats_reserved INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      instructor_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      public_url TEXT,
      price_cents INTEGER,
      currency TEXT NOT NULL DEFAULT 'COP',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      CHECK (status IN ('draft', 'published', 'closed', 'cancelled')),
      CHECK (capacity IS NULL OR capacity >= 0),
      CHECK (seats_reserved >= 0),
      CHECK (price_cents IS NULL OR price_cents >= 0)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS enrollment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cohort_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      document_number TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'web',
      enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      reviewed_by_user_id INTEGER,
      notes TEXT,
      FOREIGN KEY (cohort_id) REFERENCES course_cohorts(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (cohort_id, email),
      CHECK (status IN ('pending', 'confirmed', 'waitlist', 'cancelled', 'rejected'))
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      company_name TEXT NOT NULL DEFAULT 'Respell',
      legal_name TEXT NOT NULL DEFAULT 'Rescate - Rapelling S.A.S',
      tagline TEXT,
      services_eyebrow TEXT,
      services_title TEXT,
      testimonials_eyebrow TEXT,
      testimonials_title TEXT,
      courses_eyebrow TEXT,
      courses_title TEXT,
      platform_eyebrow TEXT,
      platform_title TEXT,
      contact_eyebrow TEXT,
      contact_title TEXT,
      primary_email TEXT,
      secondary_email TEXT,
      primary_phone TEXT,
      secondary_phone TEXT,
      whatsapp_number TEXT,
      address TEXT,
      footer_text TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await ensureTableColumn(
    'site_settings',
    'services_eyebrow',
    'ALTER TABLE site_settings ADD COLUMN services_eyebrow TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'services_title',
    'ALTER TABLE site_settings ADD COLUMN services_title TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'testimonials_eyebrow',
    'ALTER TABLE site_settings ADD COLUMN testimonials_eyebrow TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'testimonials_title',
    'ALTER TABLE site_settings ADD COLUMN testimonials_title TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'courses_eyebrow',
    'ALTER TABLE site_settings ADD COLUMN courses_eyebrow TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'courses_title',
    'ALTER TABLE site_settings ADD COLUMN courses_title TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'platform_eyebrow',
    'ALTER TABLE site_settings ADD COLUMN platform_eyebrow TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'platform_title',
    'ALTER TABLE site_settings ADD COLUMN platform_title TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'contact_eyebrow',
    'ALTER TABLE site_settings ADD COLUMN contact_eyebrow TEXT',
  )
  await ensureTableColumn(
    'site_settings',
    'contact_title',
    'ALTER TABLE site_settings ADD COLUMN contact_title TEXT',
  )

  await db.execute(`
    CREATE TABLE IF NOT EXISTS homepage_hero (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      eyebrow TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      primary_cta_label TEXT,
      primary_cta_url TEXT,
      secondary_cta_label TEXT,
      secondary_cta_url TEXT,
      chip_top TEXT,
      chip_bottom TEXT,
      background_image_url TEXT,
      is_published INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS homepage_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS homepage_testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      quote TEXT NOT NULL,
      author_name TEXT,
      rating INTEGER NOT NULL DEFAULT 5,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS homepage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS homepage_feature_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eyebrow TEXT,
      title TEXT NOT NULL,
      text TEXT,
      bullets_text TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await seedLandingDefaults()
}

function sendJson(req, res, statusCode, payload, extraHeaders = {}) {
  const origin = req.headers.origin

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || '*',
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    ...extraHeaders,
  })

  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk

      if (body.length > maxJsonBodySize) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })

    req.on('error', reject)
  })
}

function toTrimmedString(value) {
  return String(value || '').trim()
}

function toNullableString(value) {
  const normalizedValue = toTrimmedString(value)
  return normalizedValue || null
}

function toNonNegativeInteger(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) {
    return fallback
  }

  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return NaN
  }

  return parsedValue
}

function toNullableNonNegativeInteger(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return NaN
  }

  return parsedValue
}

function isIsoDateLike(value) {
  if (!value) {
    return true
  }

  return /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.+-Z]*)?$/.test(value)
}

function slugify(value) {
  return toTrimmedString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function generateCohortCode(courseSlug) {
  const base = (slugify(courseSlug) || 'cohorte').replace(/-/g, '').slice(0, 8).toUpperCase()
  const timestamp = String(Date.now()).slice(-6)
  return `${base}-${timestamp}`
}

function formatCurrencyParts(priceCents, currency = 'COP') {
  if (priceCents === null || priceCents === undefined) {
    return null
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(priceCents) / 100)
}

function getDefaultLandingContent() {
  return {
    settings: {
      companyName: 'Respell',
      legalName: 'Rescate - Rapelling S.A.S',
      tagline: 'Liderazgo operativo en rescate industrial y trabajo en altura',
      servicesEyebrow: 'Nuestros servicios',
      servicesTitle: 'Un sitio pensado para vender confianza operativa',
      testimonialsEyebrow: 'Testimonios',
      testimonialsTitle: 'La estructura visual sigue la referencia y se adapta a una propuesta comercial real',
      coursesEyebrow: 'Cursos destacados',
      coursesTitle: 'Catálogo público conectado a los cursos publicados',
      platformEyebrow: 'Plataforma',
      platformTitle: 'Base funcional para crecer hacia gestión académica y ventas en línea',
      contactEyebrow: 'Solicita información',
      contactTitle: 'Landing comercial con enfoque en conversión',
      primaryEmail: 'respellcompany@gmail.com',
      secondaryEmail: 'diroperativorespell@gmail.com',
      primaryPhone: '318 0349298',
      secondaryPhone: '310 8110995',
      whatsappNumber: '318 0349298',
      address: '',
      footerText: 'Prototipo en Vue listo para evolucionar a cursos, CRM y ventas en línea.',
    },
    hero: {
      eyebrow: 'Rescate industrial y trabajo en altura',
      title: 'Líderes en rescate industrial y trabajo en altura',
      subtitle:
        'Plataforma web para mostrar la autoridad de Respell, publicar cursos y preparar la operación comercial en línea desde una misma experiencia.',
      primaryCtaLabel: 'Ver cursos',
      primaryCtaUrl: '/cursos',
      secondaryCtaLabel: 'Ver plataforma',
      secondaryCtaUrl: '#plataforma',
      chipTop: 'Certificación y entrenamiento operativo',
      chipBottom: 'Listo para conectar CRM, cursos y ventas',
      backgroundImageUrl: '/hero-rescate.png',
      isPublished: true,
    },
    services: [
      {
        title: 'Capacitación en alturas',
        description:
          'Programas certificados para trabajo seguro, rescate vertical y maniobras especializadas.',
        icon: 'A',
        displayOrder: 1,
        isActive: true,
      },
      {
        title: 'Espacios confinados',
        description:
          'Protocolos, evaluación de riesgos y entrenamiento operativo para entornos críticos.',
        icon: 'E',
        displayOrder: 2,
        isActive: true,
      },
      {
        title: 'Brigadas de emergencia',
        description:
          'Formación táctica para respuesta rápida, mando de incidentes y evacuación.',
        icon: 'B',
        displayOrder: 3,
        isActive: true,
      },
      {
        title: 'Venta y alquiler',
        description:
          'Equipos, líneas de vida, kits de rescate y elementos de protección para cada operación.',
        icon: 'V',
        displayOrder: 4,
        isActive: true,
      },
    ],
    testimonials: [
      {
        companyName: 'TransQuim',
        quote: 'La mejor capacitación en rescate industrial que hemos recibido. Totalmente recomendados.',
        authorName: '',
        rating: 5,
        displayOrder: 1,
        isActive: true,
      },
      {
        companyName: 'TGreen',
        quote: 'Profesionales, puntuales y con un equipo de primera calidad.',
        authorName: '',
        rating: 5,
        displayOrder: 2,
        isActive: true,
      },
      {
        companyName: 'DeMA',
        quote: 'Su brigada de emergencia nos salvó en una situación crítica.',
        authorName: '',
        rating: 5,
        displayOrder: 3,
        isActive: true,
      },
    ],
    metrics: [
      { value: '+120', label: 'brigadistas capacitados', displayOrder: 1, isActive: true },
      { value: '24/7', label: 'enfoque en respuesta', displayOrder: 2, isActive: true },
      { value: '100%', label: 'alineado a operación industrial', displayOrder: 3, isActive: true },
    ],
    featureBlocks: [
      {
        eyebrow: 'Gestión académica',
        title: 'Publicación de cursos',
        text: 'Crea fichas, temarios, instructores, fechas y cupos desde un solo panel.',
        bulletsText: 'Borradores y publicación\nCatálogo público\nControl de disponibilidad',
        displayOrder: 1,
        isActive: true,
      },
      {
        eyebrow: 'Operación comercial',
        title: 'Ventas en línea',
        text: 'Base pensada para conectar checkout, órdenes y pasarela. El bloque queda listo para integrar Ofirone.',
        bulletsText: 'Inscripción por curso\nÓrdenes y estados\nIntegración futura con pagos',
        displayOrder: 2,
        isActive: true,
      },
      {
        eyebrow: 'Gestión interna',
        title: 'Seguimiento y leads',
        text: 'Centraliza solicitudes, formularios, empresas interesadas y seguimiento comercial.',
        bulletsText: 'Contactos y cotizaciones\nEmbudo comercial\nPanel para asesores',
        displayOrder: 3,
        isActive: true,
      },
    ],
  }
}

async function seedLandingDefaults() {
  const defaults = getDefaultLandingContent()

  await db.execute({
    sql: `
      INSERT OR IGNORE INTO site_settings (
        id,
        company_name,
        legal_name,
        tagline,
        services_eyebrow,
        services_title,
        testimonials_eyebrow,
        testimonials_title,
        courses_eyebrow,
        courses_title,
        platform_eyebrow,
        platform_title,
        contact_eyebrow,
        contact_title,
        primary_email,
        secondary_email,
        primary_phone,
        secondary_phone,
        whatsapp_number,
        address,
        footer_text
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      defaults.settings.companyName,
      defaults.settings.legalName,
      defaults.settings.tagline,
      defaults.settings.servicesEyebrow,
      defaults.settings.servicesTitle,
      defaults.settings.testimonialsEyebrow,
      defaults.settings.testimonialsTitle,
      defaults.settings.coursesEyebrow,
      defaults.settings.coursesTitle,
      defaults.settings.platformEyebrow,
      defaults.settings.platformTitle,
      defaults.settings.contactEyebrow,
      defaults.settings.contactTitle,
      defaults.settings.primaryEmail,
      defaults.settings.secondaryEmail,
      defaults.settings.primaryPhone,
      defaults.settings.secondaryPhone,
      defaults.settings.whatsappNumber,
      defaults.settings.address,
      defaults.settings.footerText,
    ],
  })

  await db.execute({
    sql: `
      INSERT OR IGNORE INTO homepage_hero (
        id,
        eyebrow,
        title,
        subtitle,
        primary_cta_label,
        primary_cta_url,
        secondary_cta_label,
        secondary_cta_url,
        chip_top,
        chip_bottom,
        background_image_url,
        is_published
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      defaults.hero.eyebrow,
      defaults.hero.title,
      defaults.hero.subtitle,
      defaults.hero.primaryCtaLabel,
      defaults.hero.primaryCtaUrl,
      defaults.hero.secondaryCtaLabel,
      defaults.hero.secondaryCtaUrl,
      defaults.hero.chipTop,
      defaults.hero.chipBottom,
      defaults.hero.backgroundImageUrl,
      defaults.hero.isPublished ? 1 : 0,
    ],
  })

  const servicesCount = await db.execute('SELECT COUNT(*) AS total FROM homepage_services')
  if (Number(servicesCount.rows[0]?.total || 0) === 0) {
    await db.batch(
      defaults.services.map((item) => ({
        sql: `
          INSERT INTO homepage_services (title, description, icon, display_order, is_active)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [item.title, item.description, item.icon, item.displayOrder, item.isActive ? 1 : 0],
      })),
      'write',
    )
  }

  const testimonialsCount = await db.execute('SELECT COUNT(*) AS total FROM homepage_testimonials')
  if (Number(testimonialsCount.rows[0]?.total || 0) === 0) {
    await db.batch(
      defaults.testimonials.map((item) => ({
        sql: `
          INSERT INTO homepage_testimonials (company_name, quote, author_name, rating, display_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          item.companyName,
          item.quote,
          item.authorName,
          item.rating,
          item.displayOrder,
          item.isActive ? 1 : 0,
        ],
      })),
      'write',
    )
  }

  const metricsCount = await db.execute('SELECT COUNT(*) AS total FROM homepage_metrics')
  if (Number(metricsCount.rows[0]?.total || 0) === 0) {
    await db.batch(
      defaults.metrics.map((item) => ({
        sql: `
          INSERT INTO homepage_metrics (value, label, display_order, is_active)
          VALUES (?, ?, ?, ?)
        `,
        args: [item.value, item.label, item.displayOrder, item.isActive ? 1 : 0],
      })),
      'write',
    )
  }

  const blocksCount = await db.execute('SELECT COUNT(*) AS total FROM homepage_feature_blocks')
  if (Number(blocksCount.rows[0]?.total || 0) === 0) {
    await db.batch(
      defaults.featureBlocks.map((item) => ({
        sql: `
          INSERT INTO homepage_feature_blocks (eyebrow, title, text, bullets_text, display_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          item.eyebrow,
          item.title,
          item.text,
          item.bulletsText,
          item.displayOrder,
          item.isActive ? 1 : 0,
        ],
      })),
      'write',
    )
  }
}

function mapCourseSummary(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    modality: row.modality,
    level: row.level,
    durationHours: row.duration_hours,
    coverImageUrl: row.cover_image_url,
    priceCents: row.price_cents,
    currency: row.currency,
    publicationStatus: row.publication_status,
    publishedAt: row.published_at,
    nextStartDate: row.next_start_date,
    cohortCount: Number(row.cohort_count || 0),
    publishedCohortCount: Number(row.published_cohort_count || 0),
    priceLabel: formatCurrencyParts(row.price_cents, row.currency),
  }
}

function mapCohortRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    code: row.code,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    enrollmentOpenAt: row.enrollment_open_at,
    enrollmentCloseAt: row.enrollment_close_at,
    capacity: row.capacity,
    seatsReserved: row.seats_reserved,
    location: row.location,
    instructorName: row.instructor_name,
    status: row.status,
    publicUrl: row.public_url,
    priceCents: row.price_cents,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    priceLabel: row.price_cents === null ? null : formatCurrencyParts(row.price_cents, row.currency),
  }
}

function mapEnrollmentRow(row) {
  return {
    id: row.id,
    cohortId: row.cohort_id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    cohortTitle: row.cohort_title,
    cohortCode: row.cohort_code,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    documentNumber: row.document_number,
    message: row.message,
    status: row.status,
    source: row.source,
    enrolledAt: row.enrolled_at,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedByName: row.reviewed_by_name,
    notes: row.notes,
  }
}

function toBooleanFlag(value, fallback = true) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  const normalizedValue = String(value).trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalizedValue)
}

function toBoundedInteger(value, fallback, minimum, maximum) {
  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue)) {
    return fallback
  }

  return Math.min(Math.max(parsedValue, minimum), maximum)
}

function getPaginationParams(searchParams, options = {}) {
  const defaultPage = options.defaultPage || 1
  const defaultPageSize = options.defaultPageSize || 10
  const maxPageSize = options.maxPageSize || 50
  const page = toBoundedInteger(searchParams.get('page'), defaultPage, 1, Number.MAX_SAFE_INTEGER)
  const pageSize = toBoundedInteger(searchParams.get('pageSize'), defaultPageSize, 1, maxPageSize)

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  }
}

function buildPaginationMeta(page, pageSize, totalItems) {
  const safeTotalItems = Math.max(Number(totalItems) || 0, 0)
  const totalPages = Math.max(Math.ceil(safeTotalItems / pageSize), 1)
  const currentPage = Math.min(page, totalPages)

  return {
    page: currentPage,
    pageSize,
    totalItems: safeTotalItems,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  }
}

function buildSearchLikeQuery(value) {
  const normalizedValue = toTrimmedString(value).toLowerCase()

  if (!normalizedValue) {
    return null
  }

  return `%${normalizedValue}%`
}

function normalizeLandingList(items, mapper) {
  return Array.isArray(items) ? items.map(mapper) : []
}

function normalizeLandingContent(payload) {
  const defaults = getDefaultLandingContent()
  const settingsPayload = payload?.settings || {}
  const heroPayload = payload?.hero || {}

  return {
    settings: {
      companyName: toTrimmedString(settingsPayload.companyName || defaults.settings.companyName),
      legalName: toTrimmedString(settingsPayload.legalName || defaults.settings.legalName),
      tagline: toNullableString(settingsPayload.tagline ?? defaults.settings.tagline),
      servicesEyebrow: toNullableString(settingsPayload.servicesEyebrow ?? defaults.settings.servicesEyebrow),
      servicesTitle: toTrimmedString(settingsPayload.servicesTitle || defaults.settings.servicesTitle),
      testimonialsEyebrow: toNullableString(
        settingsPayload.testimonialsEyebrow ?? defaults.settings.testimonialsEyebrow,
      ),
      testimonialsTitle: toTrimmedString(
        settingsPayload.testimonialsTitle || defaults.settings.testimonialsTitle,
      ),
      coursesEyebrow: toNullableString(settingsPayload.coursesEyebrow ?? defaults.settings.coursesEyebrow),
      coursesTitle: toTrimmedString(settingsPayload.coursesTitle || defaults.settings.coursesTitle),
      platformEyebrow: toNullableString(settingsPayload.platformEyebrow ?? defaults.settings.platformEyebrow),
      platformTitle: toTrimmedString(settingsPayload.platformTitle || defaults.settings.platformTitle),
      contactEyebrow: toNullableString(settingsPayload.contactEyebrow ?? defaults.settings.contactEyebrow),
      contactTitle: toTrimmedString(settingsPayload.contactTitle || defaults.settings.contactTitle),
      primaryEmail: toNullableString(settingsPayload.primaryEmail ?? defaults.settings.primaryEmail),
      secondaryEmail: toNullableString(settingsPayload.secondaryEmail ?? defaults.settings.secondaryEmail),
      primaryPhone: toNullableString(settingsPayload.primaryPhone ?? defaults.settings.primaryPhone),
      secondaryPhone: toNullableString(settingsPayload.secondaryPhone ?? defaults.settings.secondaryPhone),
      whatsappNumber: toNullableString(settingsPayload.whatsappNumber ?? defaults.settings.whatsappNumber),
      address: toNullableString(settingsPayload.address ?? defaults.settings.address),
      footerText: toNullableString(settingsPayload.footerText ?? defaults.settings.footerText),
    },
    hero: {
      eyebrow: toNullableString(heroPayload.eyebrow ?? defaults.hero.eyebrow),
      title: toTrimmedString(heroPayload.title || defaults.hero.title),
      subtitle: toNullableString(heroPayload.subtitle ?? defaults.hero.subtitle),
      primaryCtaLabel: toNullableString(heroPayload.primaryCtaLabel ?? defaults.hero.primaryCtaLabel),
      primaryCtaUrl: toNullableString(heroPayload.primaryCtaUrl ?? defaults.hero.primaryCtaUrl),
      secondaryCtaLabel: toNullableString(heroPayload.secondaryCtaLabel ?? defaults.hero.secondaryCtaLabel),
      secondaryCtaUrl: toNullableString(heroPayload.secondaryCtaUrl ?? defaults.hero.secondaryCtaUrl),
      chipTop: toNullableString(heroPayload.chipTop ?? defaults.hero.chipTop),
      chipBottom: toNullableString(heroPayload.chipBottom ?? defaults.hero.chipBottom),
      backgroundImageUrl: toNullableString(
        heroPayload.backgroundImageUrl ?? defaults.hero.backgroundImageUrl,
      ),
      isPublished: toBooleanFlag(heroPayload.isPublished, true),
    },
    services: normalizeLandingList(payload?.services, (item, index) => ({
      title: toTrimmedString(item?.title),
      description: toNullableString(item?.description),
      icon: toNullableString(item?.icon) || 'S',
      displayOrder: toNonNegativeInteger(item?.displayOrder, index + 1),
      isActive: toBooleanFlag(item?.isActive, true),
    })).filter((item) => item.title),
    testimonials: normalizeLandingList(payload?.testimonials, (item, index) => ({
      companyName: toTrimmedString(item?.companyName),
      quote: toTrimmedString(item?.quote),
      authorName: toNullableString(item?.authorName),
      rating: Math.min(5, Math.max(1, toNonNegativeInteger(item?.rating, 5) || 5)),
      displayOrder: toNonNegativeInteger(item?.displayOrder, index + 1),
      isActive: toBooleanFlag(item?.isActive, true),
    })).filter((item) => item.companyName && item.quote),
    metrics: normalizeLandingList(payload?.metrics, (item, index) => ({
      value: toTrimmedString(item?.value),
      label: toTrimmedString(item?.label),
      displayOrder: toNonNegativeInteger(item?.displayOrder, index + 1),
      isActive: toBooleanFlag(item?.isActive, true),
    })).filter((item) => item.value && item.label),
    featureBlocks: normalizeLandingList(payload?.featureBlocks, (item, index) => ({
      eyebrow: toNullableString(item?.eyebrow),
      title: toTrimmedString(item?.title),
      text: toNullableString(item?.text),
      bulletsText: toNullableString(item?.bulletsText),
      displayOrder: toNonNegativeInteger(item?.displayOrder, index + 1),
      isActive: toBooleanFlag(item?.isActive, true),
    })).filter((item) => item.title),
  }
}

function splitBullets(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function loadLandingContent() {
  const [settingsResult, heroResult, servicesResult, testimonialsResult, metricsResult, blocksResult] =
    await Promise.all([
      db.execute('SELECT * FROM site_settings WHERE id = 1 LIMIT 1'),
      db.execute('SELECT * FROM homepage_hero WHERE id = 1 LIMIT 1'),
      db.execute('SELECT * FROM homepage_services ORDER BY display_order ASC, id ASC'),
      db.execute('SELECT * FROM homepage_testimonials ORDER BY display_order ASC, id ASC'),
      db.execute('SELECT * FROM homepage_metrics ORDER BY display_order ASC, id ASC'),
      db.execute('SELECT * FROM homepage_feature_blocks ORDER BY display_order ASC, id ASC'),
    ])

  const settingsRow = settingsResult.rows[0] || {}
  const heroRow = heroResult.rows[0] || {}

  return {
    settings: {
      companyName: settingsRow.company_name || 'Respell',
      legalName: settingsRow.legal_name || 'Rescate - Rapelling S.A.S',
      tagline: settingsRow.tagline || '',
      servicesEyebrow: settingsRow.services_eyebrow || 'Nuestros servicios',
      servicesTitle: settingsRow.services_title || 'Un sitio pensado para vender confianza operativa',
      testimonialsEyebrow: settingsRow.testimonials_eyebrow || 'Testimonios',
      testimonialsTitle:
        settingsRow.testimonials_title ||
        'La estructura visual sigue la referencia y se adapta a una propuesta comercial real',
      coursesEyebrow: settingsRow.courses_eyebrow || 'Cursos destacados',
      coursesTitle: settingsRow.courses_title || 'Catálogo público conectado a los cursos publicados',
      platformEyebrow: settingsRow.platform_eyebrow || 'Plataforma',
      platformTitle:
        settingsRow.platform_title || 'Base funcional para crecer hacia gestión académica y ventas en línea',
      contactEyebrow: settingsRow.contact_eyebrow || 'Solicita información',
      contactTitle: settingsRow.contact_title || 'Landing comercial con enfoque en conversión',
      primaryEmail: settingsRow.primary_email || '',
      secondaryEmail: settingsRow.secondary_email || '',
      primaryPhone: settingsRow.primary_phone || '',
      secondaryPhone: settingsRow.secondary_phone || '',
      whatsappNumber: settingsRow.whatsapp_number || '',
      address: settingsRow.address || '',
      footerText: settingsRow.footer_text || '',
    },
    hero: {
      eyebrow: heroRow.eyebrow || '',
      title: heroRow.title || '',
      subtitle: heroRow.subtitle || '',
      primaryCtaLabel: heroRow.primary_cta_label || '',
      primaryCtaUrl: heroRow.primary_cta_url || '',
      secondaryCtaLabel: heroRow.secondary_cta_label || '',
      secondaryCtaUrl: heroRow.secondary_cta_url || '',
      chipTop: heroRow.chip_top || '',
      chipBottom: heroRow.chip_bottom || '',
      backgroundImageUrl: heroRow.background_image_url || '',
      isPublished: Number(heroRow.is_published || 0) === 1,
    },
    services: servicesResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      icon: row.icon,
      displayOrder: row.display_order,
      isActive: Number(row.is_active || 0) === 1,
    })),
    testimonials: testimonialsResult.rows.map((row) => ({
      id: row.id,
      companyName: row.company_name,
      quote: row.quote,
      authorName: row.author_name,
      rating: row.rating,
      displayOrder: row.display_order,
      isActive: Number(row.is_active || 0) === 1,
    })),
    metrics: metricsResult.rows.map((row) => ({
      id: row.id,
      value: row.value,
      label: row.label,
      displayOrder: row.display_order,
      isActive: Number(row.is_active || 0) === 1,
    })),
    featureBlocks: blocksResult.rows.map((row) => ({
      id: row.id,
      eyebrow: row.eyebrow,
      title: row.title,
      text: row.text,
      bulletsText: row.bullets_text || '',
      bullets: splitBullets(row.bullets_text),
      displayOrder: row.display_order,
      isActive: Number(row.is_active || 0) === 1,
    })),
  }
}

async function loadFeaturedCourses(limit = 3) {
  const result = await db.execute({
    sql: `
      SELECT
        c.id,
        c.category_id,
        c.title,
        c.slug,
        c.short_description,
        c.description,
        c.modality,
        c.level,
        c.duration_hours,
        c.cover_image_url,
        c.price_cents,
        c.currency,
        c.publication_status,
        c.published_at,
        cc.name AS category_name,
        COUNT(cohort.id) AS cohort_count,
        SUM(CASE WHEN cohort.status = 'published' THEN 1 ELSE 0 END) AS published_cohort_count,
        MIN(CASE WHEN cohort.status = 'published' THEN cohort.start_date END) AS next_start_date
      FROM courses c
      LEFT JOIN course_categories cc ON cc.id = c.category_id
      LEFT JOIN course_cohorts cohort ON cohort.course_id = c.id
      WHERE c.publication_status = 'published'
      GROUP BY
        c.id,
        c.category_id,
        c.title,
        c.slug,
        c.short_description,
        c.description,
        c.modality,
        c.level,
        c.duration_hours,
        c.cover_image_url,
        c.price_cents,
        c.currency,
        c.publication_status,
        c.published_at,
        cc.name
      ORDER BY datetime(COALESCE(c.published_at, c.created_at)) DESC, c.id DESC
      LIMIT ?
    `,
    args: [limit],
  })

  return result.rows.map(mapCourseSummary)
}

async function saveLandingContent(payload) {
  const normalizedContent = normalizeLandingContent(payload)

  await db.batch(
    [
      {
        sql: `
          INSERT INTO site_settings (
            id,
            company_name,
            legal_name,
            tagline,
            services_eyebrow,
            services_title,
            testimonials_eyebrow,
            testimonials_title,
            courses_eyebrow,
            courses_title,
            platform_eyebrow,
            platform_title,
            contact_eyebrow,
            contact_title,
            primary_email,
            secondary_email,
            primary_phone,
            secondary_phone,
            whatsapp_number,
            address,
            footer_text,
            updated_at
          )
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            company_name = excluded.company_name,
            legal_name = excluded.legal_name,
            tagline = excluded.tagline,
            services_eyebrow = excluded.services_eyebrow,
            services_title = excluded.services_title,
            testimonials_eyebrow = excluded.testimonials_eyebrow,
            testimonials_title = excluded.testimonials_title,
            courses_eyebrow = excluded.courses_eyebrow,
            courses_title = excluded.courses_title,
            platform_eyebrow = excluded.platform_eyebrow,
            platform_title = excluded.platform_title,
            contact_eyebrow = excluded.contact_eyebrow,
            contact_title = excluded.contact_title,
            primary_email = excluded.primary_email,
            secondary_email = excluded.secondary_email,
            primary_phone = excluded.primary_phone,
            secondary_phone = excluded.secondary_phone,
            whatsapp_number = excluded.whatsapp_number,
            address = excluded.address,
            footer_text = excluded.footer_text,
            updated_at = CURRENT_TIMESTAMP
        `,
        args: [
          normalizedContent.settings.companyName,
          normalizedContent.settings.legalName,
          normalizedContent.settings.tagline,
          normalizedContent.settings.servicesEyebrow,
          normalizedContent.settings.servicesTitle,
          normalizedContent.settings.testimonialsEyebrow,
          normalizedContent.settings.testimonialsTitle,
          normalizedContent.settings.coursesEyebrow,
          normalizedContent.settings.coursesTitle,
          normalizedContent.settings.platformEyebrow,
          normalizedContent.settings.platformTitle,
          normalizedContent.settings.contactEyebrow,
          normalizedContent.settings.contactTitle,
          normalizedContent.settings.primaryEmail,
          normalizedContent.settings.secondaryEmail,
          normalizedContent.settings.primaryPhone,
          normalizedContent.settings.secondaryPhone,
          normalizedContent.settings.whatsappNumber,
          normalizedContent.settings.address,
          normalizedContent.settings.footerText,
        ],
      },
      {
        sql: `
          INSERT INTO homepage_hero (
            id,
            eyebrow,
            title,
            subtitle,
            primary_cta_label,
            primary_cta_url,
            secondary_cta_label,
            secondary_cta_url,
            chip_top,
            chip_bottom,
            background_image_url,
            is_published,
            updated_at
          )
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            eyebrow = excluded.eyebrow,
            title = excluded.title,
            subtitle = excluded.subtitle,
            primary_cta_label = excluded.primary_cta_label,
            primary_cta_url = excluded.primary_cta_url,
            secondary_cta_label = excluded.secondary_cta_label,
            secondary_cta_url = excluded.secondary_cta_url,
            chip_top = excluded.chip_top,
            chip_bottom = excluded.chip_bottom,
            background_image_url = excluded.background_image_url,
            is_published = excluded.is_published,
            updated_at = CURRENT_TIMESTAMP
        `,
        args: [
          normalizedContent.hero.eyebrow,
          normalizedContent.hero.title,
          normalizedContent.hero.subtitle,
          normalizedContent.hero.primaryCtaLabel,
          normalizedContent.hero.primaryCtaUrl,
          normalizedContent.hero.secondaryCtaLabel,
          normalizedContent.hero.secondaryCtaUrl,
          normalizedContent.hero.chipTop,
          normalizedContent.hero.chipBottom,
          normalizedContent.hero.backgroundImageUrl,
          normalizedContent.hero.isPublished ? 1 : 0,
        ],
      },
      { sql: 'DELETE FROM homepage_services', args: [] },
      ...normalizedContent.services.map((item) => ({
        sql: `
          INSERT INTO homepage_services (title, description, icon, display_order, is_active, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [item.title, item.description, item.icon, item.displayOrder, item.isActive ? 1 : 0],
      })),
      { sql: 'DELETE FROM homepage_testimonials', args: [] },
      ...normalizedContent.testimonials.map((item) => ({
        sql: `
          INSERT INTO homepage_testimonials (company_name, quote, author_name, rating, display_order, is_active, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [
          item.companyName,
          item.quote,
          item.authorName,
          item.rating,
          item.displayOrder,
          item.isActive ? 1 : 0,
        ],
      })),
      { sql: 'DELETE FROM homepage_metrics', args: [] },
      ...normalizedContent.metrics.map((item) => ({
        sql: `
          INSERT INTO homepage_metrics (value, label, display_order, is_active, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [item.value, item.label, item.displayOrder, item.isActive ? 1 : 0],
      })),
      { sql: 'DELETE FROM homepage_feature_blocks', args: [] },
      ...normalizedContent.featureBlocks.map((item) => ({
        sql: `
          INSERT INTO homepage_feature_blocks (eyebrow, title, text, bullets_text, display_order, is_active, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [
          item.eyebrow,
          item.title,
          item.text,
          item.bulletsText,
          item.displayOrder,
          item.isActive ? 1 : 0,
        ],
      })),
    ],
    'write',
  )

  return loadLandingContent()
}

async function uploadImageToCloudinary(fileDataUrl, fileName, folder) {
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw new Error('Cloudinary environment variables are missing on the server.')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = slugify(fileName || `respell-${timestamp}`) || `respell-${timestamp}`
  const targetFolder = folder || cloudinaryUploadFolder
  const signatureBase = `folder=${targetFolder}&public_id=${publicId}&timestamp=${timestamp}${cloudinaryApiSecret}`
  const signature = crypto.createHash('sha1').update(signatureBase).digest('hex')

  const formData = new FormData()
  formData.append('file', fileDataUrl)
  formData.append('api_key', cloudinaryApiKey)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)
  formData.append('folder', targetFolder)
  formData.append('public_id', publicId)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    },
  )

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Cloudinary upload failed.')
  }

  return {
    publicId: payload.public_id,
    secureUrl: payload.secure_url,
    width: payload.width,
    height: payload.height,
    format: payload.format,
  }
}

function validateContactPayload(payload) {
  const name = toTrimmedString(payload.name)
  const email = toTrimmedString(payload.email)
  const message = toTrimmedString(payload.message)

  if (!name || !email || !message) {
    return { ok: false, message: 'Todos los campos son obligatorios.' }
  }

  if (name.length > 120 || email.length > 160 || message.length > 3000) {
    return { ok: false, message: 'Uno de los campos excede el tamaño permitido.' }
  }

  if (!emailPattern.test(email)) {
    return { ok: false, message: 'El correo electrónico no es válido.' }
  }

  return {
    ok: true,
    value: { name, email, message },
  }
}

function validateLoginPayload(payload) {
  const email = normalizeEmail(payload.email)
  const password = String(payload.password || '')

  if (!email || !password) {
    return { ok: false, message: 'Correo y contraseña son obligatorios.' }
  }

  return {
    ok: true,
    value: { email, password },
  }
}

function validateCategoryPayload(payload) {
  const name = toTrimmedString(payload.name)
  const slug = slugify(payload.slug || name)
  const description = toNullableString(payload.description)

  if (!name) {
    return { ok: false, message: 'El nombre de la categoría es obligatorio.' }
  }

  if (!slug) {
    return { ok: false, message: 'No fue posible generar un slug para la categoría.' }
  }

  return {
    ok: true,
    value: { name, slug, description },
  }
}

function validateCoursePayload(payload) {
  const title = toTrimmedString(payload.title)
  const slug = slugify(payload.slug || title)
  const shortDescription = toNullableString(payload.shortDescription)
  const description = toNullableString(payload.description)
  const learningObjectives = toNullableString(payload.learningObjectives)
  const targetAudience = toNullableString(payload.targetAudience)
  const modality = toTrimmedString(payload.modality || 'mixed').toLowerCase()
  const level = toTrimmedString(payload.level || 'all').toLowerCase()
  const durationHours = toNonNegativeInteger(payload.durationHours, 0)
  const coverImageUrl = toNullableString(payload.coverImageUrl)
  const priceCents = toNonNegativeInteger(payload.priceCents, 0)
  const currency = toTrimmedString(payload.currency || 'COP').toUpperCase()
  const publicationStatus = toTrimmedString(payload.publicationStatus || 'draft').toLowerCase()
  const categoryId = payload.categoryId ? Number(payload.categoryId) : null
  const categoryName = toNullableString(payload.categoryName)

  if (!title) {
    return { ok: false, message: 'El título del curso es obligatorio.' }
  }

  if (!slug) {
    return { ok: false, message: 'No fue posible generar un slug para el curso.' }
  }

  if (!allowedCourseModalities.has(modality)) {
    return { ok: false, message: 'La modalidad del curso no es válida.' }
  }

  if (!allowedCourseStatuses.has(publicationStatus)) {
    return { ok: false, message: 'El estado de publicación del curso no es válido.' }
  }

  if (Number.isNaN(durationHours) || Number.isNaN(priceCents)) {
    return { ok: false, message: 'Duración y precio deben ser números enteros mayores o iguales a cero.' }
  }

  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) {
    return { ok: false, message: 'La categoría seleccionada no es válida.' }
  }

  return {
    ok: true,
    value: {
      title,
      slug,
      shortDescription,
      description,
      learningObjectives,
      targetAudience,
      modality,
      level,
      durationHours,
      coverImageUrl,
      priceCents,
      currency,
      publicationStatus,
      categoryId,
      categoryName,
    },
  }
}

function validateCohortPayload(payload, courseSlug = '') {
  const code = toTrimmedString(payload.code) || generateCohortCode(courseSlug)
  const title = toNullableString(payload.title)
  const startDate = toTrimmedString(payload.startDate)
  const endDate = toNullableString(payload.endDate)
  const enrollmentOpenAt = toNullableString(payload.enrollmentOpenAt)
  const enrollmentCloseAt = toNullableString(payload.enrollmentCloseAt)
  const capacity = toNullableNonNegativeInteger(payload.capacity)
  const location = toNullableString(payload.location)
  const instructorName = toNullableString(payload.instructorName)
  const status = toTrimmedString(payload.status || 'draft').toLowerCase()
  const publicUrl = toNullableString(payload.publicUrl)
  const priceCents = toNullableNonNegativeInteger(payload.priceCents)
  const currency = toTrimmedString(payload.currency || 'COP').toUpperCase()

  if (!startDate) {
    return { ok: false, message: 'La fecha de inicio de la cohorte es obligatoria.' }
  }

  if (!allowedCohortStatuses.has(status)) {
    return { ok: false, message: 'El estado de la cohorte no es válido.' }
  }

  if (
    !isIsoDateLike(startDate) ||
    !isIsoDateLike(endDate) ||
    !isIsoDateLike(enrollmentOpenAt) ||
    !isIsoDateLike(enrollmentCloseAt)
  ) {
    return { ok: false, message: 'Una de las fechas de la cohorte no tiene un formato válido.' }
  }

  if (Number.isNaN(capacity) || Number.isNaN(priceCents)) {
    return { ok: false, message: 'Capacidad y precio de cohorte deben ser números enteros mayores o iguales a cero.' }
  }

  return {
    ok: true,
    value: {
      code,
      title,
      startDate,
      endDate,
      enrollmentOpenAt,
      enrollmentCloseAt,
      capacity,
      location,
      instructorName,
      status,
      publicUrl,
      priceCents,
      currency,
    },
  }
}

function validateEnrollmentPayload(payload) {
  const cohortId = Number(payload.cohortId)
  const fullName = toTrimmedString(payload.fullName)
  const email = normalizeEmail(payload.email)
  const phone = toNullableString(payload.phone)
  const company = toNullableString(payload.company)
  const documentNumber = toNullableString(payload.documentNumber)
  const message = toNullableString(payload.message)

  if (!Number.isInteger(cohortId) || cohortId <= 0) {
    return { ok: false, message: 'Debes seleccionar una cohorte válida.' }
  }

  if (!fullName || !email) {
    return { ok: false, message: 'Nombre completo y correo son obligatorios para la inscripción.' }
  }

  if (!emailPattern.test(email)) {
    return { ok: false, message: 'El correo ingresado no es válido.' }
  }

  return {
    ok: true,
    value: {
      cohortId,
      fullName,
      email,
      phone,
      company,
      documentNumber,
      message,
    },
  }
}

function validateEnrollmentAdminPayload(payload) {
  const status = toTrimmedString(payload.status).toLowerCase()
  const notes = toNullableString(payload.notes)

  if (!status) {
    return { ok: false, message: 'Debes indicar un estado para la inscripción.' }
  }

  if (!allowedEnrollmentStatuses.has(status)) {
    return { ok: false, message: 'El estado de la inscripción no es válido.' }
  }

  return {
    ok: true,
    value: {
      status,
      notes,
    },
  }
}

async function getCurrentSession(req) {
  const cookies = parseCookies(req.headers.cookie)
  const rawToken = cookies[SESSION_COOKIE]

  if (!rawToken) {
    return null
  }

  const sessionTokenHash = hashSessionToken(rawToken)
  const result = await db.execute({
    sql: `
      SELECT
        sessions.id,
        sessions.user_id,
        sessions.expires_at,
        users.email,
        users.name,
        users.role
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.session_token_hash = ?
        AND datetime(sessions.expires_at) > datetime('now')
      LIMIT 1
    `,
    args: [sessionTokenHash],
  })

  const session = result.rows[0]

  if (!session) {
    return null
  }

  await db.execute({
    sql: `
      UPDATE sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    args: [session.id],
  })

  return {
    id: session.id,
    userId: session.user_id,
    expiresAt: session.expires_at,
    user: {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
    },
  }
}

async function requireSession(req, res) {
  const session = await getCurrentSession(req)

  if (!session) {
    sendJson(req, res, 401, { ok: false, message: 'Debes iniciar sesión.' })
    return null
  }

  return session
}

async function createSession(userId) {
  const rawToken = generateSessionToken()
  const tokenHash = hashSessionToken(rawToken)
  const expiresAt = addDays(new Date(), SESSION_DURATION_DAYS).toISOString()

  await db.execute({
    sql: `
      INSERT INTO sessions (session_token_hash, user_id, expires_at)
      VALUES (?, ?, ?)
    `,
    args: [tokenHash, userId, expiresAt],
  })

  return {
    rawToken,
    expiresAt,
    maxAgeSeconds: SESSION_DURATION_DAYS * 24 * 60 * 60,
  }
}

async function destroySessionByRequest(req) {
  const cookies = parseCookies(req.headers.cookie)
  const rawToken = cookies[SESSION_COOKIE]

  if (!rawToken) {
    return
  }

  await db.execute({
    sql: 'DELETE FROM sessions WHERE session_token_hash = ?',
    args: [hashSessionToken(rawToken)],
  })
}

async function ensureCategoryId(categoryId, categoryName) {
  if (categoryId) {
    return categoryId
  }

  if (!categoryName) {
    return null
  }

  const normalizedSlug = slugify(categoryName)
  const result = await db.execute({
    sql: `
      SELECT id
      FROM course_categories
      WHERE slug = ?
      LIMIT 1
    `,
    args: [normalizedSlug],
  })

  const existingCategory = result.rows[0]

  if (existingCategory) {
    return Number(existingCategory.id)
  }

  const insertResult = await db.execute({
    sql: `
      INSERT INTO course_categories (name, slug)
      VALUES (?, ?)
    `,
    args: [categoryName, normalizedSlug],
  })

  return Number(insertResult.lastInsertRowid)
}

async function loadCourseById(courseId) {
  const result = await db.execute({
    sql: `
      SELECT *
      FROM courses
      WHERE id = ?
      LIMIT 1
    `,
    args: [courseId],
  })

  return result.rows[0] || null
}

async function loadCourseDetails(courseId) {
  const courseResult = await db.execute({
    sql: `
      SELECT
        c.*,
        cc.name AS category_name
      FROM courses c
      LEFT JOIN course_categories cc ON cc.id = c.category_id
      WHERE c.id = ?
      LIMIT 1
    `,
    args: [courseId],
  })

  const course = courseResult.rows[0]

  if (!course) {
    return null
  }

  const cohortsResult = await db.execute({
    sql: `
      SELECT *
      FROM course_cohorts
      WHERE course_id = ?
      ORDER BY datetime(start_date) ASC, id ASC
    `,
    args: [courseId],
  })

  return {
    course: {
      id: course.id,
      categoryId: course.category_id,
      categoryName: course.category_name,
      title: course.title,
      slug: course.slug,
      shortDescription: course.short_description,
      description: course.description,
      learningObjectives: course.learning_objectives,
      targetAudience: course.target_audience,
      modality: course.modality,
      level: course.level,
      durationHours: course.duration_hours,
      coverImageUrl: course.cover_image_url,
      priceCents: course.price_cents,
      currency: course.currency,
      publicationStatus: course.publication_status,
      publishedAt: course.published_at,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
      priceLabel: formatCurrencyParts(course.price_cents, course.currency),
    },
    cohorts: cohortsResult.rows.map(mapCohortRow),
  }
}

function isUniqueConstraintError(error) {
  return String(error.message || '').toLowerCase().includes('unique')
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const publicCourseMatch = url.pathname.match(/^\/api\/courses\/([^/]+)$/)
  const publicEnrollmentMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/enroll$/)
  const adminCourseByIdMatch = url.pathname.match(/^\/api\/admin\/courses\/(\d+)$/)
  const adminCourseCohortsMatch = url.pathname.match(/^\/api\/admin\/courses\/(\d+)\/cohorts$/)
  const adminCohortByIdMatch = url.pathname.match(/^\/api\/admin\/cohorts\/(\d+)$/)
  const adminEnrollmentByIdMatch = url.pathname.match(/^\/api\/admin\/enrollments\/(\d+)$/)

  if (req.method === 'OPTIONS') {
    return sendJson(req, res, 200, { ok: true })
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(req, res, 200, { ok: true, service: 'respell-api' })
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/session') {
    try {
      const session = await getCurrentSession(req)

      if (!session) {
        return sendJson(req, res, 401, { ok: false, message: 'No hay una sesión autenticada.' })
      }

      return sendJson(req, res, 200, { ok: true, user: session.user })
    } catch (error) {
      console.error('Error loading session:', error)
      return sendJson(req, res, 500, { ok: false, message: 'No fue posible validar la sesión.' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    try {
      const payload = await readJsonBody(req)
      const validation = validateLoginPayload(payload)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const { email, password } = validation.value
      const result = await db.execute({
        sql: `
          SELECT id, email, password_hash, name, role
          FROM users
          WHERE email = ?
          LIMIT 1
        `,
        args: [email],
      })

      const user = result.rows[0]
      const isValid = user ? await verifyPassword(password, user.password_hash) : false

      if (!user || !isValid) {
        return sendJson(req, res, 401, {
          ok: false,
          message: 'Credenciales inválidas. Verifica correo y contraseña.',
        })
      }

      const session = await createSession(user.id)

      return sendJson(
        req,
        res,
        200,
        {
          ok: true,
          message: 'Sesión iniciada correctamente.',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
        {
          'Set-Cookie': serializeSessionCookie(session.rawToken, session.maxAgeSeconds),
        },
      )
    } catch (error) {
      console.error('Error logging in:', error)
      return sendJson(req, res, 500, { ok: false, message: 'No fue posible iniciar sesión.' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    try {
      await destroySessionByRequest(req)

      return sendJson(
        req,
        res,
        200,
        { ok: true, message: 'Sesión cerrada correctamente.' },
        { 'Set-Cookie': serializeExpiredSessionCookie() },
      )
    } catch (error) {
      console.error('Error logging out:', error)
      return sendJson(req, res, 500, { ok: false, message: 'No fue posible cerrar sesión.' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/contact') {
    try {
      const payload = await readJsonBody(req)
      const validation = validateContactPayload(payload)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const { name, email, message } = validation.value

      await db.execute({
        sql: `
          INSERT INTO contact_requests (name, email, message, source)
          VALUES (?, ?, ?, ?)
        `,
        args: [name, email, message, 'landing-page'],
      })

      return sendJson(req, res, 201, {
        ok: true,
        message: 'Solicitud enviada correctamente. Ya quedó registrada en Turso.',
      })
    } catch (error) {
      console.error('Error saving contact request:', error)

      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible guardar la solicitud en este momento.',
      })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/public/landing') {
    try {
      const [landingContent, featuredCourses] = await Promise.all([
        loadLandingContent(),
        loadFeaturedCourses(3),
      ])

      return sendJson(req, res, 200, {
        ok: true,
        ...landingContent,
        featuredCourses,
      })
    } catch (error) {
      console.error('Error loading public landing content:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar el contenido público de la landing.',
      })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/landing-content') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const landingContent = await loadLandingContent()

      return sendJson(req, res, 200, {
        ok: true,
        user: session.user,
        ...landingContent,
      })
    } catch (error) {
      console.error('Error loading admin landing content:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar la configuración de la landing.',
      })
    }
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/landing-content') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const payload = await readJsonBody(req)
      const landingContent = await saveLandingContent(payload)

      return sendJson(req, res, 200, {
        ok: true,
        message: 'Contenido de la landing actualizado correctamente.',
        user: session.user,
        ...landingContent,
      })
    } catch (error) {
      console.error('Error updating landing content:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible actualizar el contenido de la landing.',
      })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/uploads/image') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const payload = await readJsonBody(req)
      const fileDataUrl = toTrimmedString(payload.fileDataUrl)
      const fileName = toTrimmedString(payload.fileName || 'respell-image')
      const folder = toTrimmedString(payload.folder || cloudinaryUploadFolder)

      if (!fileDataUrl.startsWith('data:image/')) {
        return sendJson(req, res, 400, {
          ok: false,
          message: 'Debes enviar una imagen válida codificada como data URL.',
        })
      }

      const uploadedFile = await uploadImageToCloudinary(fileDataUrl, fileName, folder)

      return sendJson(req, res, 201, {
        ok: true,
        message: 'Imagen subida correctamente.',
        item: uploadedFile,
      })
    } catch (error) {
      console.error('Error uploading image to Cloudinary:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: error.message || 'No fue posible subir la imagen a Cloudinary.',
      })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/courses') {
    try {
      const requestedLimit = Number(url.searchParams.get('limit') || 12)
      const limit =
        Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 12
      const result = await db.execute({
        sql: `
          SELECT
            c.id,
            c.category_id,
            c.title,
            c.slug,
            c.short_description,
            c.description,
            c.modality,
            c.level,
            c.duration_hours,
            c.cover_image_url,
            c.price_cents,
            c.currency,
            c.publication_status,
            c.published_at,
            cc.name AS category_name,
            COUNT(cohort.id) AS cohort_count,
            SUM(CASE WHEN cohort.status = 'published' THEN 1 ELSE 0 END) AS published_cohort_count,
            MIN(CASE WHEN cohort.status = 'published' THEN cohort.start_date END) AS next_start_date
          FROM courses c
          LEFT JOIN course_categories cc ON cc.id = c.category_id
          LEFT JOIN course_cohorts cohort ON cohort.course_id = c.id
          WHERE c.publication_status = 'published'
          GROUP BY
            c.id,
            c.category_id,
            c.title,
            c.slug,
            c.short_description,
            c.description,
            c.modality,
            c.level,
            c.duration_hours,
            c.cover_image_url,
            c.price_cents,
            c.currency,
            c.publication_status,
            c.published_at,
            cc.name
          ORDER BY datetime(COALESCE(c.published_at, c.created_at)) DESC, c.id DESC
          LIMIT ?
        `,
        args: [limit],
      })

      return sendJson(req, res, 200, {
        ok: true,
        items: result.rows.map(mapCourseSummary),
      })
    } catch (error) {
      console.error('Error loading public courses:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar el catálogo público de cursos.',
      })
    }
  }

  if (req.method === 'GET' && publicCourseMatch) {
    try {
      const courseSlug = decodeURIComponent(publicCourseMatch[1])
      const courseResult = await db.execute({
        sql: `
          SELECT
            c.*,
            cc.name AS category_name
          FROM courses c
          LEFT JOIN course_categories cc ON cc.id = c.category_id
          WHERE c.slug = ?
            AND c.publication_status = 'published'
          LIMIT 1
        `,
        args: [courseSlug],
      })

      const course = courseResult.rows[0]

      if (!course) {
        return sendJson(req, res, 404, { ok: false, message: 'Curso no encontrado.' })
      }

      const cohortsResult = await db.execute({
        sql: `
          SELECT *
          FROM course_cohorts
          WHERE course_id = ?
            AND status = 'published'
          ORDER BY datetime(start_date) ASC, id ASC
        `,
        args: [course.id],
      })

      return sendJson(req, res, 200, {
        ok: true,
        item: {
          id: course.id,
          categoryId: course.category_id,
          categoryName: course.category_name,
          title: course.title,
          slug: course.slug,
          shortDescription: course.short_description,
          description: course.description,
          learningObjectives: course.learning_objectives,
          targetAudience: course.target_audience,
          modality: course.modality,
          level: course.level,
          durationHours: course.duration_hours,
          coverImageUrl: course.cover_image_url,
          priceCents: course.price_cents,
          currency: course.currency,
          publicationStatus: course.publication_status,
          publishedAt: course.published_at,
          priceLabel: formatCurrencyParts(course.price_cents, course.currency),
          cohorts: cohortsResult.rows.map(mapCohortRow),
        },
      })
    } catch (error) {
      console.error('Error loading public course detail:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar el detalle del curso.',
      })
    }
  }

  if (req.method === 'POST' && publicEnrollmentMatch) {
    try {
      const courseSlug = decodeURIComponent(publicEnrollmentMatch[1])
      const payload = await readJsonBody(req)
      const validation = validateEnrollmentPayload(payload)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const { cohortId, fullName, email, phone, company, documentNumber, message } = validation.value
      const courseResult = await db.execute({
        sql: `
          SELECT id
          FROM courses
          WHERE slug = ?
            AND publication_status = 'published'
          LIMIT 1
        `,
        args: [courseSlug],
      })

      const course = courseResult.rows[0]

      if (!course) {
        return sendJson(req, res, 404, { ok: false, message: 'Curso no disponible para inscripción.' })
      }

      const cohortResult = await db.execute({
        sql: `
          SELECT *
          FROM course_cohorts
          WHERE id = ?
            AND course_id = ?
            AND status = 'published'
          LIMIT 1
        `,
        args: [cohortId, course.id],
      })

      const cohort = cohortResult.rows[0]

      if (!cohort) {
        return sendJson(req, res, 400, { ok: false, message: 'La cohorte seleccionada no está disponible.' })
      }

      const activeEnrollmentsResult = await db.execute({
        sql: `
          SELECT COUNT(*) AS total
          FROM enrollment_requests
          WHERE cohort_id = ?
            AND status IN ('pending', 'confirmed')
        `,
        args: [cohortId],
      })

      const currentActiveEnrollments = Number(activeEnrollmentsResult.rows[0]?.total || 0)
      const capacity = cohort.capacity === null ? null : Number(cohort.capacity)
      const initialStatus =
        capacity !== null && currentActiveEnrollments >= capacity ? 'waitlist' : 'pending'

      await db.execute({
        sql: `
          INSERT INTO enrollment_requests (
            cohort_id,
            course_id,
            full_name,
            email,
            phone,
            company,
            document_number,
            message,
            status,
            source
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          cohortId,
          course.id,
          fullName,
          email,
          phone,
          company,
          documentNumber,
          message,
          initialStatus,
          'web-course-detail',
        ],
      })

      return sendJson(req, res, 201, {
        ok: true,
        message:
          initialStatus === 'waitlist'
            ? 'La cohorte ya no tiene cupos inmediatos. Tu solicitud quedó en lista de espera.'
            : 'Tu solicitud de inscripción fue registrada correctamente.',
      })
    } catch (error) {
      console.error('Error creating enrollment request:', error)

      if (isUniqueConstraintError(error)) {
        return sendJson(req, res, 409, {
          ok: false,
          message: 'Ya existe una solicitud registrada con este correo para la cohorte seleccionada.',
        })
      }

      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible registrar la inscripción en este momento.',
      })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/contact-requests') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const { page, pageSize, offset } = getPaginationParams(url.searchParams)
      const searchLikeQuery = buildSearchLikeQuery(url.searchParams.get('q'))
      const whereClauses = []
      const whereArgs = []

      if (searchLikeQuery) {
        whereClauses.push(`
          (
            lower(name) LIKE ?
            OR lower(email) LIKE ?
            OR lower(message) LIKE ?
            OR lower(source) LIKE ?
          )
        `)
        whereArgs.push(searchLikeQuery, searchLikeQuery, searchLikeQuery, searchLikeQuery)
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const totalResult = await db.execute({
        sql: `
          SELECT COUNT(*) AS total
          FROM contact_requests
          ${whereSql}
        `,
        args: whereArgs,
      })
      const totalItems = Number(totalResult.rows[0]?.total || 0)
      const result = await db.execute({
        sql: `
          SELECT id, name, email, message, source, created_at
          FROM contact_requests
          ${whereSql}
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT ? OFFSET ?
        `,
        args: [...whereArgs, pageSize, offset],
      })

      return sendJson(req, res, 200, {
        ok: true,
        user: session.user,
        items: result.rows,
        pagination: buildPaginationMeta(page, pageSize, totalItems),
      })
    } catch (error) {
      console.error('Error loading contact requests:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar las solicitudes administrativas.',
      })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/course-categories') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const result = await db.execute(`
        SELECT id, name, slug, description, created_at, updated_at
        FROM course_categories
        ORDER BY name ASC
      `)

      return sendJson(req, res, 200, {
        ok: true,
        user: session.user,
        items: result.rows,
      })
    } catch (error) {
      console.error('Error loading course categories:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar las categorías.',
      })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/course-categories') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const payload = await readJsonBody(req)
      const validation = validateCategoryPayload(payload)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const { name, slug, description } = validation.value
      const result = await db.execute({
        sql: `
          INSERT INTO course_categories (name, slug, description)
          VALUES (?, ?, ?)
        `,
        args: [name, slug, description],
      })

      return sendJson(req, res, 201, {
        ok: true,
        message: 'Categoría creada correctamente.',
        item: {
          id: Number(result.lastInsertRowid),
          name,
          slug,
          description,
        },
      })
    } catch (error) {
      console.error('Error creating category:', error)

      if (isUniqueConstraintError(error)) {
        return sendJson(req, res, 409, {
          ok: false,
          message: 'Ya existe una categoría con ese slug.',
        })
      }

      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible crear la categoría.',
      })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/courses') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const { page, pageSize, offset } = getPaginationParams(url.searchParams)
      const searchLikeQuery = buildSearchLikeQuery(url.searchParams.get('q'))
      const whereClauses = []
      const whereArgs = []

      if (searchLikeQuery) {
        whereClauses.push(`
          (
            lower(c.title) LIKE ?
            OR lower(c.slug) LIKE ?
            OR lower(COALESCE(cc.name, '')) LIKE ?
            OR lower(c.publication_status) LIKE ?
          )
        `)
        whereArgs.push(searchLikeQuery, searchLikeQuery, searchLikeQuery, searchLikeQuery)
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const totalResult = await db.execute({
        sql: `
          SELECT COUNT(*) AS total
          FROM courses c
          LEFT JOIN course_categories cc ON cc.id = c.category_id
          ${whereSql}
        `,
        args: whereArgs,
      })
      const totalItems = Number(totalResult.rows[0]?.total || 0)
      const result = await db.execute({
        sql: `
          SELECT
            c.id,
            c.category_id,
            c.title,
            c.slug,
            c.short_description,
            c.description,
            c.modality,
            c.level,
            c.duration_hours,
            c.cover_image_url,
            c.price_cents,
            c.currency,
            c.publication_status,
            c.published_at,
            cc.name AS category_name,
            (
              SELECT COUNT(*)
              FROM course_cohorts cohort
              WHERE cohort.course_id = c.id
            ) AS cohort_count,
            (
              SELECT COUNT(*)
              FROM course_cohorts cohort
              WHERE cohort.course_id = c.id
                AND cohort.status = 'published'
            ) AS published_cohort_count,
            (
              SELECT MIN(cohort.start_date)
              FROM course_cohorts cohort
              WHERE cohort.course_id = c.id
                AND cohort.status = 'published'
            ) AS next_start_date
          FROM courses c
          LEFT JOIN course_categories cc ON cc.id = c.category_id
          ${whereSql}
          ORDER BY datetime(c.updated_at) DESC, c.id DESC
          LIMIT ? OFFSET ?
        `,
        args: [...whereArgs, pageSize, offset],
      })

      return sendJson(req, res, 200, {
        ok: true,
        user: session.user,
        items: result.rows.map(mapCourseSummary),
        pagination: buildPaginationMeta(page, pageSize, totalItems),
      })
    } catch (error) {
      console.error('Error loading admin courses:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar los cursos administrativos.',
      })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/courses') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const payload = await readJsonBody(req)
      const validation = validateCoursePayload(payload)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const categoryId = await ensureCategoryId(validation.value.categoryId, validation.value.categoryName)
      const publishedAt = validation.value.publicationStatus === 'published' ? new Date().toISOString() : null

      const result = await db.execute({
        sql: `
          INSERT INTO courses (
            category_id,
            title,
            slug,
            short_description,
            description,
            learning_objectives,
            target_audience,
            modality,
            level,
            duration_hours,
            cover_image_url,
            price_cents,
            currency,
            publication_status,
            published_at,
            created_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          categoryId,
          validation.value.title,
          validation.value.slug,
          validation.value.shortDescription,
          validation.value.description,
          validation.value.learningObjectives,
          validation.value.targetAudience,
          validation.value.modality,
          validation.value.level,
          validation.value.durationHours,
          validation.value.coverImageUrl,
          validation.value.priceCents,
          validation.value.currency,
          validation.value.publicationStatus,
          publishedAt,
          session.userId,
        ],
      })

      const details = await loadCourseDetails(Number(result.lastInsertRowid))

      return sendJson(req, res, 201, {
        ok: true,
        message: 'Curso creado correctamente.',
        item: details,
      })
    } catch (error) {
      console.error('Error creating course:', error)

      if (isUniqueConstraintError(error)) {
        return sendJson(req, res, 409, {
          ok: false,
          message: 'Ya existe un curso con ese slug.',
        })
      }

      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible crear el curso.',
      })
    }
  }

  if (req.method === 'GET' && adminCourseByIdMatch) {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const courseId = Number(adminCourseByIdMatch[1])
      const details = await loadCourseDetails(courseId)

      if (!details) {
        return sendJson(req, res, 404, { ok: false, message: 'Curso no encontrado.' })
      }

      return sendJson(req, res, 200, {
        ok: true,
        user: session.user,
        item: details,
      })
    } catch (error) {
      console.error('Error loading admin course detail:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar el detalle del curso.',
      })
    }
  }

  if (req.method === 'PUT' && adminCourseByIdMatch) {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const courseId = Number(adminCourseByIdMatch[1])
      const existingCourse = await loadCourseById(courseId)

      if (!existingCourse) {
        return sendJson(req, res, 404, { ok: false, message: 'Curso no encontrado.' })
      }

      const payload = await readJsonBody(req)
      const validation = validateCoursePayload(payload)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const categoryId = await ensureCategoryId(validation.value.categoryId, validation.value.categoryName)
      const publishedAt =
        validation.value.publicationStatus === 'published'
          ? existingCourse.published_at || new Date().toISOString()
          : null

      await db.execute({
        sql: `
          UPDATE courses
          SET
            category_id = ?,
            title = ?,
            slug = ?,
            short_description = ?,
            description = ?,
            learning_objectives = ?,
            target_audience = ?,
            modality = ?,
            level = ?,
            duration_hours = ?,
            cover_image_url = ?,
            price_cents = ?,
            currency = ?,
            publication_status = ?,
            published_at = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [
          categoryId,
          validation.value.title,
          validation.value.slug,
          validation.value.shortDescription,
          validation.value.description,
          validation.value.learningObjectives,
          validation.value.targetAudience,
          validation.value.modality,
          validation.value.level,
          validation.value.durationHours,
          validation.value.coverImageUrl,
          validation.value.priceCents,
          validation.value.currency,
          validation.value.publicationStatus,
          publishedAt,
          courseId,
        ],
      })

      const details = await loadCourseDetails(courseId)

      return sendJson(req, res, 200, {
        ok: true,
        message: 'Curso actualizado correctamente.',
        item: details,
      })
    } catch (error) {
      console.error('Error updating course:', error)

      if (isUniqueConstraintError(error)) {
        return sendJson(req, res, 409, {
          ok: false,
          message: 'Ya existe otro curso con ese slug.',
        })
      }

      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible actualizar el curso.',
      })
    }
  }

  if (req.method === 'POST' && adminCourseCohortsMatch) {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const courseId = Number(adminCourseCohortsMatch[1])
      const course = await loadCourseById(courseId)

      if (!course) {
        return sendJson(req, res, 404, { ok: false, message: 'Curso no encontrado para crear la cohorte.' })
      }

      const payload = await readJsonBody(req)
      const validation = validateCohortPayload(payload, course.slug)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const cohort = validation.value

      const result = await db.execute({
        sql: `
          INSERT INTO course_cohorts (
            course_id,
            code,
            title,
            start_date,
            end_date,
            enrollment_open_at,
            enrollment_close_at,
            capacity,
            location,
            instructor_name,
            status,
            public_url,
            price_cents,
            currency
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          courseId,
          cohort.code,
          cohort.title,
          cohort.startDate,
          cohort.endDate,
          cohort.enrollmentOpenAt,
          cohort.enrollmentCloseAt,
          cohort.capacity,
          cohort.location,
          cohort.instructorName,
          cohort.status,
          cohort.publicUrl,
          cohort.priceCents,
          cohort.currency,
        ],
      })

      const cohortResult = await db.execute({
        sql: 'SELECT * FROM course_cohorts WHERE id = ? LIMIT 1',
        args: [Number(result.lastInsertRowid)],
      })

      return sendJson(req, res, 201, {
        ok: true,
        message: 'Cohorte creada correctamente.',
        item: mapCohortRow(cohortResult.rows[0]),
      })
    } catch (error) {
      console.error('Error creating cohort:', error)

      if (isUniqueConstraintError(error)) {
        return sendJson(req, res, 409, {
          ok: false,
          message: 'Ya existe una cohorte con ese código.',
        })
      }

      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible crear la cohorte.',
      })
    }
  }

  if (req.method === 'PUT' && adminCohortByIdMatch) {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const cohortId = Number(adminCohortByIdMatch[1])
      const currentCohortResult = await db.execute({
        sql: `
          SELECT cohort.*, course.slug AS course_slug
          FROM course_cohorts cohort
          INNER JOIN courses course ON course.id = cohort.course_id
          WHERE cohort.id = ?
          LIMIT 1
        `,
        args: [cohortId],
      })

      const currentCohort = currentCohortResult.rows[0]

      if (!currentCohort) {
        return sendJson(req, res, 404, { ok: false, message: 'Cohorte no encontrada.' })
      }

      const payload = await readJsonBody(req)
      const validation = validateCohortPayload(payload, currentCohort.course_slug)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const cohort = validation.value

      await db.execute({
        sql: `
          UPDATE course_cohorts
          SET
            code = ?,
            title = ?,
            start_date = ?,
            end_date = ?,
            enrollment_open_at = ?,
            enrollment_close_at = ?,
            capacity = ?,
            location = ?,
            instructor_name = ?,
            status = ?,
            public_url = ?,
            price_cents = ?,
            currency = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [
          cohort.code,
          cohort.title,
          cohort.startDate,
          cohort.endDate,
          cohort.enrollmentOpenAt,
          cohort.enrollmentCloseAt,
          cohort.capacity,
          cohort.location,
          cohort.instructorName,
          cohort.status,
          cohort.publicUrl,
          cohort.priceCents,
          cohort.currency,
          cohortId,
        ],
      })

      const updatedResult = await db.execute({
        sql: 'SELECT * FROM course_cohorts WHERE id = ? LIMIT 1',
        args: [cohortId],
      })

      return sendJson(req, res, 200, {
        ok: true,
        message: 'Cohorte actualizada correctamente.',
        item: mapCohortRow(updatedResult.rows[0]),
      })
    } catch (error) {
      console.error('Error updating cohort:', error)

      if (isUniqueConstraintError(error)) {
        return sendJson(req, res, 409, {
          ok: false,
          message: 'Ya existe otra cohorte con ese código.',
        })
      }

      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible actualizar la cohorte.',
      })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/enrollments') {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const { page, pageSize, offset } = getPaginationParams(url.searchParams)
      const requestedStatus = toTrimmedString(url.searchParams.get('status')).toLowerCase()
      const requestedCourseId = toTrimmedString(url.searchParams.get('courseId'))
      const requestedCourseIdNumber = requestedCourseId ? Number(requestedCourseId) : null
      const searchLikeQuery = buildSearchLikeQuery(url.searchParams.get('q'))
      const whereClauses = []
      const whereArgs = []

      if (requestedStatus && allowedEnrollmentStatuses.has(requestedStatus)) {
        whereClauses.push('er.status = ?')
        whereArgs.push(requestedStatus)
      }

      if (requestedCourseId && Number.isInteger(requestedCourseIdNumber) && requestedCourseIdNumber > 0) {
        whereClauses.push('er.course_id = ?')
        whereArgs.push(requestedCourseIdNumber)
      }

      if (searchLikeQuery) {
        whereClauses.push(`
          (
            lower(er.full_name) LIKE ?
            OR lower(er.email) LIKE ?
            OR lower(COALESCE(er.phone, '')) LIKE ?
            OR lower(COALESCE(er.company, '')) LIKE ?
            OR lower(c.title) LIKE ?
            OR lower(COALESCE(cohort.title, '')) LIKE ?
            OR lower(cohort.code) LIKE ?
            OR lower(er.status) LIKE ?
          )
        `)
        whereArgs.push(
          searchLikeQuery,
          searchLikeQuery,
          searchLikeQuery,
          searchLikeQuery,
          searchLikeQuery,
          searchLikeQuery,
          searchLikeQuery,
          searchLikeQuery,
        )
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const totalResult = await db.execute({
        sql: `
          SELECT COUNT(*) AS total
          FROM enrollment_requests er
          INNER JOIN courses c ON c.id = er.course_id
          INNER JOIN course_cohorts cohort ON cohort.id = er.cohort_id
          ${whereSql}
        `,
        args: whereArgs,
      })
      const totalItems = Number(totalResult.rows[0]?.total || 0)
      const result = await db.execute({
        sql: `
          SELECT
            er.id,
            er.cohort_id,
            er.course_id,
            er.full_name,
            er.email,
            er.phone,
            er.company,
            er.document_number,
            er.message,
            er.status,
            er.source,
            er.enrolled_at,
            er.reviewed_at,
            er.reviewed_by_user_id,
            er.notes,
            c.title AS course_title,
            c.slug AS course_slug,
            cohort.title AS cohort_title,
            cohort.code AS cohort_code,
            reviewer.name AS reviewed_by_name
          FROM enrollment_requests er
          INNER JOIN courses c ON c.id = er.course_id
          INNER JOIN course_cohorts cohort ON cohort.id = er.cohort_id
          LEFT JOIN users reviewer ON reviewer.id = er.reviewed_by_user_id
          ${whereSql}
          ORDER BY datetime(er.enrolled_at) DESC, er.id DESC
          LIMIT ? OFFSET ?
        `,
        args: [...whereArgs, pageSize, offset],
      })
      const items = result.rows.map(mapEnrollmentRow)

      return sendJson(req, res, 200, {
        ok: true,
        user: session.user,
        items,
        pagination: buildPaginationMeta(page, pageSize, totalItems),
      })
    } catch (error) {
      console.error('Error loading enrollments:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible cargar las inscripciones administrativas.',
      })
    }
  }

  if (req.method === 'PUT' && adminEnrollmentByIdMatch) {
    try {
      const session = await requireSession(req, res)

      if (!session) {
        return
      }

      const enrollmentId = Number(adminEnrollmentByIdMatch[1])
      const payload = await readJsonBody(req)
      const validation = validateEnrollmentAdminPayload(payload)

      if (!validation.ok) {
        return sendJson(req, res, 400, { ok: false, message: validation.message })
      }

      const currentResult = await db.execute({
        sql: `
          SELECT id
          FROM enrollment_requests
          WHERE id = ?
          LIMIT 1
        `,
        args: [enrollmentId],
      })

      if (!currentResult.rows[0]) {
        return sendJson(req, res, 404, { ok: false, message: 'Solicitud de inscripción no encontrada.' })
      }

      await db.execute({
        sql: `
          UPDATE enrollment_requests
          SET
            status = ?,
            notes = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            reviewed_by_user_id = ?
          WHERE id = ?
        `,
        args: [validation.value.status, validation.value.notes, session.userId, enrollmentId],
      })

      const updatedResult = await db.execute({
        sql: `
          SELECT
            er.id,
            er.cohort_id,
            er.course_id,
            er.full_name,
            er.email,
            er.phone,
            er.company,
            er.document_number,
            er.message,
            er.status,
            er.source,
            er.enrolled_at,
            er.reviewed_at,
            er.reviewed_by_user_id,
            er.notes,
            c.title AS course_title,
            c.slug AS course_slug,
            cohort.title AS cohort_title,
            cohort.code AS cohort_code,
            reviewer.name AS reviewed_by_name
          FROM enrollment_requests er
          INNER JOIN courses c ON c.id = er.course_id
          INNER JOIN course_cohorts cohort ON cohort.id = er.cohort_id
          LEFT JOIN users reviewer ON reviewer.id = er.reviewed_by_user_id
          WHERE er.id = ?
          LIMIT 1
        `,
        args: [enrollmentId],
      })

      return sendJson(req, res, 200, {
        ok: true,
        message: 'Inscripción actualizada correctamente.',
        item: mapEnrollmentRow(updatedResult.rows[0]),
      })
    } catch (error) {
      console.error('Error updating enrollment:', error)
      return sendJson(req, res, 500, {
        ok: false,
        message: 'No fue posible actualizar la inscripción.',
      })
    }
  }

  return sendJson(req, res, 404, { ok: false, message: 'Ruta no encontrada.' })
})

ensureSchema()
  .then(() => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Respell API listening on http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('Error initializing Turso schema:', error)
    process.exit(1)
  })
