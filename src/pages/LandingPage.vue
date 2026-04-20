<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequest, buildApiUrl, readResponsePayload } from '../lib/api'

const defaultLandingContent = {
  settings: {
    companyName: 'Respell',
    legalName: 'Rescate - Rapelling S.A.S',
    tagline: 'Liderazgo operativo en rescate industrial y trabajo en altura',
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
      isActive: true,
    },
    {
      title: 'Espacios confinados',
      description:
        'Protocolos, evaluación de riesgos y entrenamiento operativo para entornos críticos.',
      icon: 'E',
      isActive: true,
    },
    {
      title: 'Brigadas de emergencia',
      description:
        'Formación táctica para respuesta rápida, mando de incidentes y evacuación.',
      icon: 'B',
      isActive: true,
    },
    {
      title: 'Venta y alquiler',
      description:
        'Equipos, líneas de vida, kits de rescate y elementos de protección para cada operación.',
      icon: 'V',
      isActive: true,
    },
  ],
  testimonials: [
    {
      companyName: 'TransQuim',
      quote: 'La mejor capacitación en rescate industrial que hemos recibido. Totalmente recomendados.',
      rating: 5,
      isActive: true,
    },
    {
      companyName: 'TGreen',
      quote: 'Profesionales, puntuales y con un equipo de primera calidad.',
      rating: 5,
      isActive: true,
    },
    {
      companyName: 'DeMA',
      quote: 'Su brigada de emergencia nos salvó en una situación crítica.',
      rating: 5,
      isActive: true,
    },
  ],
  metrics: [
    { value: '+120', label: 'brigadistas capacitados', isActive: true },
    { value: '24/7', label: 'enfoque en respuesta', isActive: true },
    { value: '100%', label: 'alineado a operación industrial', isActive: true },
  ],
  featureBlocks: [
    {
      eyebrow: 'Gestión académica',
      title: 'Publicación de cursos',
      text: 'Crea fichas, temarios, instructores, fechas y cupos desde un solo panel.',
      bulletsText: 'Borradores y publicación\nCatálogo público\nControl de disponibilidad',
      isActive: true,
    },
    {
      eyebrow: 'Operación comercial',
      title: 'Ventas en línea',
      text: 'Base pensada para conectar checkout, órdenes y pasarela. El bloque queda listo para integrar Ofirone.',
      bulletsText: 'Inscripción por curso\nÓrdenes y estados\nIntegración futura con pagos',
      isActive: true,
    },
    {
      eyebrow: 'Gestión interna',
      title: 'Seguimiento y leads',
      text: 'Centraliza solicitudes, formularios, empresas interesadas y seguimiento comercial.',
      bulletsText: 'Contactos y cotizaciones\nEmbudo comercial\nPanel para asesores',
      isActive: true,
    },
  ],
  featuredCourses: [],
}

const landingContent = ref(defaultLandingContent)
const isLandingLoading = ref(true)
const showScrollTopButton = ref(false)

const contactForm = reactive({
  name: '',
  email: '',
  message: '',
})

const submissionMessage = ref('')
const submissionState = ref('idle')
const isSubmitting = ref(false)

const settings = computed(() => landingContent.value?.settings || {})
const hero = computed(() => landingContent.value?.hero || {})
const services = computed(() => (landingContent.value?.services || []).filter((item) => item.isActive))
const testimonials = computed(() =>
  (landingContent.value?.testimonials || []).filter((item) => item.isActive),
)
const metrics = computed(() => (landingContent.value?.metrics || []).filter((item) => item.isActive))
const featureBlocks = computed(() =>
  (landingContent.value?.featureBlocks || []).filter((item) => item.isActive),
)
const publicCourses = computed(() => landingContent.value?.featuredCourses || [])

const heroPanelStyle = computed(() => ({
  '--hero-image': `url('${hero.value.backgroundImageUrl || '/hero-rescate.png'}')`,
}))

function formatDate(value) {
  if (!value) {
    return 'Cohorte por confirmar'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function normalizeCtaUrl(value) {
  return value || '#contacto'
}

function updateScrollTopButtonVisibility() {
  showScrollTopButton.value = window.scrollY > 420
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

async function loadLanding() {
  isLandingLoading.value = true

  try {
    const result = await apiRequest('/api/public/landing')
    landingContent.value = result
  } catch {
    landingContent.value = defaultLandingContent
  } finally {
    isLandingLoading.value = false
  }
}

async function handleSubmit() {
  submissionMessage.value = ''
  submissionState.value = 'idle'
  isSubmitting.value = true

  try {
    const response = await fetch(buildApiUrl('/api/contact'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: contactForm.name,
        email: contactForm.email,
        message: contactForm.message,
      }),
    })

    const result = await readResponsePayload(response)

    if (!response.ok) {
      throw new Error(
        result?.message ||
          'No fue posible enviar la solicitud. Revisa que la API local esté ejecutándose.',
      )
    }

    submissionState.value = 'success'
    submissionMessage.value =
      result?.message || 'Solicitud enviada correctamente. Ya quedó registrada en Turso.'

    contactForm.name = ''
    contactForm.email = ''
    contactForm.message = ''
  } catch (error) {
    submissionState.value = 'error'
    submissionMessage.value = error.message || 'Error inesperado al enviar el formulario.'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  loadLanding()
  updateScrollTopButtonVisibility()
  window.addEventListener('scroll', updateScrollTopButtonVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScrollTopButtonVisibility)
})
</script>

<template>
  <div class="page-shell">
    <div class="background-orb orb-one"></div>
    <div class="background-orb orb-two"></div>

    <main class="site-card">
      <header class="topbar">
        <a class="brand" href="#inicio" aria-label="Ir al inicio de Respell">
          <img src="/respell-logo-header.png" alt="Logo de Respell" class="brand-logo" />
        </a>

        <nav class="nav-menu" aria-label="Navegación principal">
          <a href="#inicio">Inicio</a>
          <a href="#testimonios">Testimonios</a>
          <a href="#servicios">Servicios</a>
          <a href="#cursos">Cursos</a>
          <a href="#contacto">Contacto</a>
          <RouterLink to="/admin">Admin</RouterLink>
        </nav>

        <a class="button button-solid topbar-cta" href="#contacto">Inscríbete</a>
      </header>

      <section id="inicio" class="hero-panel" :style="heroPanelStyle">
        <div class="hero-copy">
          <span class="eyebrow">{{ hero.eyebrow || 'Rescate industrial y trabajo en altura' }}</span>
          <h1>{{ hero.title || 'Líderes en rescate industrial y trabajo en altura' }}</h1>
          <p>
            {{
              hero.subtitle ||
              'Plataforma web para mostrar la autoridad de Respell, publicar cursos y preparar la operación comercial en línea desde una misma experiencia.'
            }}
          </p>

          <div class="hero-actions">
            <a class="button button-solid" :href="normalizeCtaUrl(hero.primaryCtaUrl)">
              {{ hero.primaryCtaLabel || 'Ver cursos' }}
            </a>
            <a class="button button-ghost" :href="normalizeCtaUrl(hero.secondaryCtaUrl)">
              {{ hero.secondaryCtaLabel || 'Ver plataforma' }}
            </a>
          </div>

          <div class="metrics-grid">
            <article v-for="metric in metrics" :key="metric.label" class="metric-card">
              <strong>{{ metric.value }}</strong>
              <span>{{ metric.label }}</span>
            </article>
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="hero-chip chip-top">{{ hero.chipTop || 'Certificación y entrenamiento operativo' }}</div>
          <div class="hero-chip chip-bottom">{{ hero.chipBottom || 'Listo para conectar CRM, cursos y ventas' }}</div>
        </div>
      </section>

      <section id="servicios" class="section section-light">
        <div class="section-heading">
          <span class="eyebrow eyebrow-dark">{{ settings.servicesEyebrow || 'Nuestros servicios' }}</span>
          <h2>{{ settings.servicesTitle || 'Un sitio pensado para vender confianza operativa' }}</h2>
        </div>

        <div class="services-grid">
          <article v-for="service in services" :key="service.title" class="service-card">
            <div class="service-icon">{{ service.icon }}</div>
            <h3>{{ service.title }}</h3>
            <p>{{ service.description }}</p>
          </article>
        </div>
      </section>

      <section id="testimonios" class="section section-neutral">
        <div class="section-heading">
          <span class="eyebrow eyebrow-dark">{{ settings.testimonialsEyebrow || 'Testimonios' }}</span>
          <h2>
            {{
              settings.testimonialsTitle ||
              'La estructura visual sigue la referencia y se adapta a una propuesta comercial real'
            }}
          </h2>
        </div>

        <div class="testimonials-row">
          <article v-for="testimonial in testimonials" :key="testimonial.companyName" class="testimonial-card">
            <strong>{{ testimonial.companyName }}</strong>
            <p>"{{ testimonial.quote }}"</p>
            <span class="stars">{{ '★'.repeat(testimonial.rating || 5) }}</span>
          </article>
        </div>
      </section>

      <section id="cursos" class="section courses-section">
        <div class="section-heading">
          <span class="eyebrow">{{ settings.coursesEyebrow || 'Cursos destacados' }}</span>
          <h2>{{ settings.coursesTitle || 'Catálogo público conectado a los cursos publicados' }}</h2>
        </div>

        <div v-if="!publicCourses.length && !isLandingLoading" class="empty-state empty-state-dark">
          Aún no hay cursos publicados desde el panel. Cuando publiques el primero, aparecerá aquí.
        </div>

        <div v-else class="courses-grid">
          <article v-for="course in publicCourses" :key="course.id" class="course-card">
            <span class="course-type">{{ course.categoryName || 'Curso Respell' }}</span>
            <h3>{{ course.title }}</h3>
            <p>{{ course.shortDescription || `${course.modality} · ${course.durationHours} horas` }}</p>
            <div class="course-footer">
              <span class="course-status">{{ formatDate(course.nextStartDate) }}</span>
              <RouterLink :to="`/cursos/${course.slug}`">Ver detalle</RouterLink>
            </div>
          </article>
        </div>
      </section>

      <section id="plataforma" class="section section-light">
        <div class="section-heading">
          <span class="eyebrow eyebrow-dark">{{ settings.platformEyebrow || 'Plataforma' }}</span>
          <h2>
            {{
              settings.platformTitle || 'Base funcional para crecer hacia gestión académica y ventas en línea'
            }}
          </h2>
        </div>

        <div class="modules-grid">
          <article v-for="block in featureBlocks" :key="block.title" class="module-card">
            <span class="module-eyebrow">{{ block.eyebrow }}</span>
            <h3>{{ block.title }}</h3>
            <p>{{ block.text }}</p>
            <ul>
              <li v-for="point in block.bullets || []" :key="point">{{ point }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="contacto" class="contact-section">
        <div class="contact-info">
          <span class="eyebrow">{{ settings.contactEyebrow || 'Solicita información' }}</span>
          <h2>{{ settings.contactTitle || 'Landing comercial con enfoque en conversión' }}</h2>
          <p>
            Esta sección está lista para convertirse en un formulario conectado, captura de leads y
            seguimiento de oportunidades.
          </p>

          <div class="contact-list">
            <div v-if="settings.whatsappNumber || settings.primaryPhone || settings.secondaryPhone">
              <span>WhatsApp</span>
              {{ [settings.whatsappNumber, settings.primaryPhone, settings.secondaryPhone].filter(Boolean).join(' · ') }}
            </div>
            <div v-if="settings.primaryEmail"><span>Correo</span> {{ settings.primaryEmail }}</div>
            <div v-if="settings.secondaryEmail"><span>Soporte</span> {{ settings.secondaryEmail }}</div>
          </div>
        </div>

        <form class="contact-form" @submit.prevent="handleSubmit">
          <h3>Solicita información</h3>
          <input v-model="contactForm.name" type="text" placeholder="Nombre" required />
          <input
            v-model="contactForm.email"
            type="email"
            placeholder="Correo electrónico"
            required
          />
          <textarea
            v-model="contactForm.message"
            rows="4"
            placeholder="Mensaje"
            required
          ></textarea>
          <button type="submit" class="button button-solid button-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Enviando...' : 'Enviar' }}
          </button>
          <p
            v-if="submissionMessage"
            class="form-feedback"
            :class="submissionState === 'error' ? 'is-error' : 'is-success'"
          >
            {{ submissionMessage }}
          </p>
        </form>
      </section>

      <footer class="footer">
        <div>
          <strong>{{ settings.companyName || 'Respell' }}</strong>
          <span>{{ settings.legalName || 'Rescate - Rapelling S.A.S' }}</span>
        </div>
        <p>{{ settings.footerText || 'Prototipo en Vue listo para evolucionar a cursos, CRM y ventas en línea.' }}</p>
      </footer>
    </main>

    <button
      v-if="showScrollTopButton"
      type="button"
      class="scroll-top-button"
      aria-label="Volver al inicio"
      @click="scrollToTop"
    >
      ↑
    </button>
  </div>
</template>
