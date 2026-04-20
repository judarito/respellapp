-- 004_landing_content.sql
-- Contenido administrable para landing page y configuración general del sitio

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Respell',
  legal_name TEXT NOT NULL DEFAULT 'Rescate - Rapelling S.A.S',
  tagline TEXT,
  primary_email TEXT,
  secondary_email TEXT,
  primary_phone TEXT,
  secondary_phone TEXT,
  whatsapp_number TEXT,
  address TEXT,
  footer_text TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS homepage_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS homepage_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

INSERT OR IGNORE INTO site_settings (
  id,
  company_name,
  legal_name,
  tagline,
  primary_email,
  secondary_email,
  primary_phone,
  secondary_phone,
  whatsapp_number,
  footer_text
)
VALUES (
  1,
  'Respell',
  'Rescate - Rapelling S.A.S',
  'Liderazgo operativo en rescate industrial y trabajo en altura',
  'respellcompany@gmail.com',
  'diroperativorespell@gmail.com',
  '318 0349298',
  '310 8110995',
  '318 0349298',
  'Prototipo en Vue listo para evolucionar a cursos, CRM y ventas online.'
);

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
VALUES (
  1,
  'Rescate industrial y trabajo en altura',
  'Líderes en rescate industrial y trabajo en altura',
  'Plataforma web para mostrar la autoridad de Respell, publicar cursos y preparar la operación comercial online desde una misma experiencia.',
  'Ver cursos',
  '/cursos',
  'Ver plataforma',
  '#plataforma',
  'Certificación y entrenamiento operativo',
  'Listo para conectar CRM, cursos y ventas',
  '/hero-rescate.png',
  1
);
