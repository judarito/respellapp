<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { apiRequest } from '../lib/api'

const route = useRoute()
const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')
const submissionMessage = ref('')
const submissionState = ref('idle')
const course = ref(null)

const enrollmentForm = reactive({
  cohortId: '',
  fullName: '',
  email: '',
  phone: '',
  company: '',
  documentNumber: '',
  message: '',
})

const cohorts = computed(() => course.value?.cohorts || [])

function formatDate(value) {
  if (!value) {
    return 'Por confirmar'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

async function loadCourse() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await apiRequest(`/api/courses/${encodeURIComponent(route.params.slug)}`)
    course.value = result.item

    if (!enrollmentForm.cohortId && result.item?.cohorts?.length) {
      enrollmentForm.cohortId = String(result.item.cohorts[0].id)
    }
  } catch (error) {
    errorMessage.value = error.message || 'No fue posible cargar el curso.'
  } finally {
    isLoading.value = false
  }
}

async function handleEnrollment() {
  submissionMessage.value = ''
  submissionState.value = 'idle'
  isSubmitting.value = true

  try {
    const result = await apiRequest(`/api/courses/${encodeURIComponent(route.params.slug)}/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cohortId: Number(enrollmentForm.cohortId),
        fullName: enrollmentForm.fullName,
        email: enrollmentForm.email,
        phone: enrollmentForm.phone,
        company: enrollmentForm.company,
        documentNumber: enrollmentForm.documentNumber,
        message: enrollmentForm.message,
      }),
    })

    submissionState.value = 'success'
    submissionMessage.value = result.message || 'Solicitud registrada correctamente.'
    enrollmentForm.fullName = ''
    enrollmentForm.email = ''
    enrollmentForm.phone = ''
    enrollmentForm.company = ''
    enrollmentForm.documentNumber = ''
    enrollmentForm.message = ''
  } catch (error) {
    submissionState.value = 'error'
    submissionMessage.value = error.message || 'No fue posible registrar la inscripción.'
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => route.params.slug,
  async () => {
    await loadCourse()
  },
)

onMounted(loadCourse)
</script>

<template>
  <div class="page-shell">
    <div class="background-orb orb-one"></div>
    <div class="background-orb orb-two"></div>

    <main class="site-card">
      <header class="topbar">
        <RouterLink class="brand" to="/" aria-label="Ir al inicio de Respell">
          <img src="/respell-logo-header.png" alt="Logo de Respell" class="brand-logo" />
        </RouterLink>

        <nav class="nav-menu" aria-label="Navegación principal">
          <RouterLink to="/">Inicio</RouterLink>
          <RouterLink to="/cursos">Cursos</RouterLink>
          <RouterLink to="/login">Login</RouterLink>
          <RouterLink to="/admin">Admin</RouterLink>
        </nav>

        <RouterLink class="button button-solid topbar-cta" to="/cursos">Volver al catálogo</RouterLink>
      </header>

      <section v-if="isLoading" class="section section-light">
        <div class="empty-state">Cargando curso...</div>
      </section>

      <section v-else-if="errorMessage" class="section section-light">
        <p class="form-feedback is-error">{{ errorMessage }}</p>
      </section>

      <template v-else-if="course">
        <section class="course-detail-hero">
          <div class="course-detail-copy">
            <span class="eyebrow">{{ course.categoryName || 'Curso Respell' }}</span>
            <h1>{{ course.title }}</h1>
            <p>{{ course.shortDescription || course.description }}</p>

            <div class="course-detail-highlights">
              <div>
                <strong>{{ course.priceLabel || 'Valor por confirmar' }}</strong>
                <span>Inversión referencial</span>
              </div>
              <div>
                <strong>{{ course.modality }}</strong>
                <span>Modalidad</span>
              </div>
              <div>
                <strong>{{ course.durationHours }} horas</strong>
                <span>Duración</span>
              </div>
            </div>
          </div>
        </section>

        <section class="section section-light">
          <div class="course-detail-layout">
            <div class="course-detail-content">
              <article class="course-detail-card">
                <h2>Descripción general</h2>
                <p>{{ course.description || 'El administrador puede ampliar aquí el detalle completo del programa.' }}</p>
              </article>

              <article class="course-detail-card">
                <h2>Objetivos de aprendizaje</h2>
                <p>{{ course.learningObjectives || 'Pendiente de definir desde el panel administrativo.' }}</p>
              </article>

              <article class="course-detail-card">
                <h2>Público objetivo</h2>
                <p>{{ course.targetAudience || 'Definir audiencia objetivo para afinar la conversión comercial.' }}</p>
              </article>

              <article class="course-detail-card">
                <h2>Cohortes publicadas</h2>

                <div v-if="!cohorts.length" class="empty-state">
                  Este curso aún no tiene cohortes públicas disponibles.
                </div>

                <div v-else class="detail-cohort-grid">
                  <article v-for="cohort in cohorts" :key="cohort.id" class="detail-cohort-card">
                    <div class="detail-cohort-head">
                      <strong>{{ cohort.title || cohort.code }}</strong>
                      <span>{{ cohort.status }}</span>
                    </div>
                    <p>Inicio: {{ formatDate(cohort.startDate) }}</p>
                    <p>Fin: {{ formatDate(cohort.endDate) }}</p>
                    <p>{{ cohort.location || 'Ubicación por confirmar' }}</p>
                    <p>{{ cohort.instructorName || 'Instructor por confirmar' }}</p>
                    <small>{{ cohort.priceLabel || course.priceLabel || 'Precio por confirmar' }}</small>
                  </article>
                </div>
              </article>
            </div>

            <form class="contact-form course-enrollment-form" @submit.prevent="handleEnrollment">
              <h3>Inscribirse al curso</h3>

              <select v-model="enrollmentForm.cohortId" required>
                <option disabled value="">Selecciona una cohorte</option>
                <option v-for="cohort in cohorts" :key="cohort.id" :value="String(cohort.id)">
                  {{ cohort.title || cohort.code }} · {{ formatDate(cohort.startDate) }}
                </option>
              </select>

              <input v-model="enrollmentForm.fullName" type="text" placeholder="Nombre completo" required />
              <input v-model="enrollmentForm.email" type="email" placeholder="Correo electrónico" required />
              <input v-model="enrollmentForm.phone" type="text" placeholder="Teléfono" />
              <input v-model="enrollmentForm.company" type="text" placeholder="Empresa" />
              <input v-model="enrollmentForm.documentNumber" type="text" placeholder="Documento" />
              <textarea v-model="enrollmentForm.message" rows="4" placeholder="Mensaje adicional"></textarea>

              <button
                type="submit"
                class="button button-solid button-full"
                :disabled="isSubmitting || !cohorts.length"
              >
                {{ isSubmitting ? 'Enviando...' : 'Enviar inscripción' }}
              </button>

              <p
                v-if="submissionMessage"
                class="form-feedback"
                :class="submissionState === 'error' ? 'is-error' : 'is-success'"
              >
                {{ submissionMessage }}
              </p>
            </form>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
