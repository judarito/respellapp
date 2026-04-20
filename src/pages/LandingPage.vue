<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequest, buildApiUrl, readResponsePayload } from '../lib/api'

const landingContent = ref(null)
const isLandingLoading = ref(true)

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

async function loadLanding() {
  isLandingLoading.value = true

  try {
    const result = await apiRequest('/api/public/landing')
    landingContent.value = result
  } catch {
    landingContent.value = null
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

onMounted(loadLanding)
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
          <a href="#nosotros">Nosotros</a>
          <a href="#servicios">Servicios</a>
          <a href="#cursos">Cursos</a>
          <a href="#blog">Blog</a>
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
              'Plataforma web para mostrar la autoridad de Respell, publicar cursos y preparar la operación comercial online desde una misma experiencia.'
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
          <span class="eyebrow eyebrow-dark">Nuestros servicios</span>
          <h2>Un sitio pensado para vender confianza operativa</h2>
        </div>

        <div class="services-grid">
          <article v-for="service in services" :key="service.title" class="service-card">
            <div class="service-icon">{{ service.icon }}</div>
            <h3>{{ service.title }}</h3>
            <p>{{ service.description }}</p>
          </article>
        </div>
      </section>

      <section id="nosotros" class="section section-neutral">
        <div class="section-heading">
          <span class="eyebrow eyebrow-dark">Testimonios</span>
          <h2>La estructura visual sigue la referencia y se adapta a una propuesta comercial real</h2>
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
          <span class="eyebrow">Cursos destacados</span>
          <h2>Catálogo público conectado a los cursos publicados</h2>
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
          <span class="eyebrow eyebrow-dark">Plataforma</span>
          <h2>Base funcional para crecer hacia gestión académica y ventas online</h2>
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

      <section id="blog" class="contact-section">
        <div class="contact-info">
          <span class="eyebrow">Solicita información</span>
          <h2>{{ settings.tagline || 'Landing comercial con enfoque en conversión' }}</h2>
          <p>
            Dejé esta sección lista para convertirse en formulario conectado, captura de leads y
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

        <form id="contacto" class="contact-form" @submit.prevent="handleSubmit">
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
        <p>{{ settings.footerText || 'Prototipo en Vue listo para evolucionar a cursos, CRM y ventas online.' }}</p>
      </footer>
    </main>
  </div>
</template>
