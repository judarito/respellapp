<script setup>
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequest, readResponsePayload } from '../lib/api'

const services = [
  {
    title: 'Capacitación en alturas',
    text: 'Programas certificados para trabajo seguro, rescate vertical y maniobras especializadas.',
    icon: 'A',
  },
  {
    title: 'Espacios confinados',
    text: 'Protocolos, evaluación de riesgos y entrenamiento operativo para entornos críticos.',
    icon: 'E',
  },
  {
    title: 'Brigadas de emergencia',
    text: 'Formación táctica para respuesta rápida, mando de incidentes y evacuación.',
    icon: 'B',
  },
  {
    title: 'Venta y alquiler',
    text: 'Equipos, líneas de vida, kits de rescate y elementos de protección para cada operación.',
    icon: 'V',
  },
]

const testimonials = [
  {
    name: 'TransQuim',
    quote:
      'La mejor capacitación en rescate industrial que hemos recibido. Totalmente recomendados.',
  },
  {
    name: 'TGreen',
    quote: 'Profesionales, puntuales y con un equipo de primera calidad.',
  },
  {
    name: 'DeMA',
    quote: 'Su brigada de emergencia nos salvó en una situación crítica.',
  },
]

const modules = [
  {
    eyebrow: 'Gestión académica',
    title: 'Publicación de cursos',
    text: 'Crea fichas, temarios, instructores, fechas y cupos desde un solo panel.',
    points: ['Borradores y publicación', 'Catálogo público', 'Control de disponibilidad'],
  },
  {
    eyebrow: 'Operación comercial',
    title: 'Ventas online',
    text: 'Base pensada para conectar checkout, órdenes y pasarela. Dejé el bloque listo para integrar Ofirone.',
    points: ['Inscripción por curso', 'Órdenes y estados', 'Integración futura con pagos'],
  },
  {
    eyebrow: 'Backoffice',
    title: 'Seguimiento y leads',
    text: 'Centraliza solicitudes, formularios, empresas interesadas y seguimiento comercial.',
    points: ['Contactos y cotizaciones', 'Embudo comercial', 'Panel para asesores'],
  },
]

const metrics = [
  { value: '+120', label: 'brigadistas capacitados' },
  { value: '24/7', label: 'enfoque en respuesta' },
  { value: '100%', label: 'alineado a operación industrial' },
]

const publicCourses = ref([])

const contactForm = reactive({
  name: '',
  email: '',
  message: '',
})

const submissionMessage = ref('')
const submissionState = ref('idle')
const isSubmitting = ref(false)

function formatDate(value) {
  if (!value) {
    return 'Cohorte por confirmar'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

async function loadFeaturedCourses() {
  try {
    const result = await apiRequest('/api/courses?limit=3')
    publicCourses.value = result.items || []
  } catch {
    publicCourses.value = []
  }
}

async function handleSubmit() {
  submissionMessage.value = ''
  submissionState.value = 'idle'
  isSubmitting.value = true

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
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

onMounted(loadFeaturedCourses)
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
          <RouterLink to="/login">Login</RouterLink>
          <RouterLink to="/admin">Admin</RouterLink>
        </nav>

        <a class="button button-solid topbar-cta" href="#contacto">Inscríbete</a>
      </header>

      <section id="inicio" class="hero-panel">
        <div class="hero-copy">
          <span class="eyebrow">Rescate industrial y trabajo en altura</span>
          <h1>Líderes en rescate industrial y trabajo en altura</h1>
          <p>
            Plataforma web para mostrar la autoridad de Respell, publicar cursos y preparar la
            operación comercial online desde una misma experiencia.
          </p>

          <div class="hero-actions">
            <RouterLink class="button button-solid" to="/cursos">Ver cursos</RouterLink>
            <a class="button button-ghost" href="#plataforma">Ver plataforma</a>
          </div>

          <div class="metrics-grid">
            <article v-for="metric in metrics" :key="metric.label" class="metric-card">
              <strong>{{ metric.value }}</strong>
              <span>{{ metric.label }}</span>
            </article>
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="hero-chip chip-top">Certificación y entrenamiento operativo</div>
          <div class="hero-chip chip-bottom">Listo para conectar CRM, cursos y ventas</div>
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
            <p>{{ service.text }}</p>
          </article>
        </div>
      </section>

      <section id="nosotros" class="section section-neutral">
        <div class="section-heading">
          <span class="eyebrow eyebrow-dark">Testimonios</span>
          <h2>La estructura visual sigue la referencia y se adapta a una propuesta comercial real</h2>
        </div>

        <div class="testimonials-row">
          <article v-for="testimonial in testimonials" :key="testimonial.name" class="testimonial-card">
            <strong>{{ testimonial.name }}</strong>
            <p>"{{ testimonial.quote }}"</p>
            <span class="stars">★★★★★</span>
          </article>
        </div>
      </section>

      <section id="cursos" class="section courses-section">
        <div class="section-heading">
          <span class="eyebrow">Cursos destacados</span>
          <h2>Catálogo público conectado a los cursos publicados</h2>
        </div>

        <div v-if="!publicCourses.length" class="empty-state empty-state-dark">
          Aún no hay cursos publicados desde el panel. Cuando publiques el primero, aparecerá aquí.
        </div>

        <div v-else class="courses-grid">
          <article v-for="course in publicCourses" :key="course.id" class="course-card">
            <span class="course-type">{{ course.categoryName || 'Curso Respell' }}</span>
            <h3>{{ course.title }}</h3>
            <p>
              {{ course.shortDescription || `${course.modality} · ${course.durationHours} horas` }}
            </p>
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
          <article v-for="module in modules" :key="module.title" class="module-card">
            <span class="module-eyebrow">{{ module.eyebrow }}</span>
            <h3>{{ module.title }}</h3>
            <p>{{ module.text }}</p>
            <ul>
              <li v-for="point in module.points" :key="point">{{ point }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="blog" class="contact-section">
        <div class="contact-info">
          <span class="eyebrow">Solicita información</span>
          <h2>Landing comercial con enfoque en conversión</h2>
          <p>
            Dejé esta sección lista para convertirse en formulario conectado, captura de leads y
            seguimiento de oportunidades.
          </p>

          <div class="contact-list">
            <div><span>WhatsApp</span> 318 0349298 · 310 8110995</div>
            <div><span>Correo</span> respellcompany@gmail.com</div>
            <div><span>Soporte</span> diroperativorespell@gmail.com</div>
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
          <strong>Respell</strong>
          <span>Rescate - Rapelling S.A.S</span>
        </div>
        <p>Prototipo en Vue listo para evolucionar a cursos, CRM y ventas online.</p>
      </footer>
    </main>
  </div>
</template>
