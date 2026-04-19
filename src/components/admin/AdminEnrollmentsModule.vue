<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { apiRequest } from '../../lib/api'

const isLoading = ref(false)
const isSaving = ref(false)
const feedbackMessage = ref('')
const feedbackState = ref('idle')
const enrollments = ref([])
const selectedEnrollmentId = ref(null)

const filters = reactive({
  status: '',
  q: '',
})

const reviewForm = reactive({
  status: 'pending',
  notes: '',
})

const filteredEnrollments = computed(() => {
  const query = filters.q.trim().toLowerCase()

  return enrollments.value.filter((item) => {
    const matchesStatus = !filters.status || item.status === filters.status

    if (!matchesStatus) {
      return false
    }

    if (!query) {
      return true
    }

    return [
      item.fullName,
      item.email,
      item.phone,
      item.company,
      item.courseTitle,
      item.cohortTitle,
      item.cohortCode,
      item.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
})

const selectedEnrollment = computed(() => {
  if (!filteredEnrollments.value.length) {
    return null
  }

  return (
    filteredEnrollments.value.find((item) => item.id === selectedEnrollmentId.value) ||
    filteredEnrollments.value[0]
  )
})

function setFeedback(message, state = 'success') {
  feedbackMessage.value = message
  feedbackState.value = state
}

function syncReviewForm(item) {
  reviewForm.status = item?.status || 'pending'
  reviewForm.notes = item?.notes || ''
}

function selectEnrollment(id) {
  selectedEnrollmentId.value = id
  const item = enrollments.value.find((entry) => entry.id === id) || null
  syncReviewForm(item)
}

function formatDate(value) {
  if (!value) {
    return 'Sin revisar'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function loadEnrollments() {
  isLoading.value = true

  try {
    const params = new URLSearchParams()

    if (filters.status) {
      params.set('status', filters.status)
    }

    if (filters.q.trim()) {
      params.set('q', filters.q.trim())
    }

    const query = params.toString()
    const result = await apiRequest(`/api/admin/enrollments${query ? `?${query}` : ''}`)
    enrollments.value = result.items || []
    selectedEnrollmentId.value = result.items?.[0]?.id || null
    syncReviewForm(result.items?.[0] || null)
  } catch (error) {
    setFeedback(error.message || 'No fue posible cargar las inscripciones.', 'error')
  } finally {
    isLoading.value = false
  }
}

async function handleSaveReview() {
  if (!selectedEnrollment.value) {
    return
  }

  isSaving.value = true
  feedbackMessage.value = ''
  feedbackState.value = 'idle'

  try {
    const result = await apiRequest(`/api/admin/enrollments/${selectedEnrollment.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: reviewForm.status,
        notes: reviewForm.notes,
      }),
    })

    const updatedItem = result.item
    enrollments.value = enrollments.value.map((item) =>
      item.id === updatedItem.id ? updatedItem : item,
    )
    selectedEnrollmentId.value = updatedItem.id
    syncReviewForm(updatedItem)
    setFeedback(result.message || 'Inscripción actualizada correctamente.')
  } catch (error) {
    setFeedback(error.message || 'No fue posible actualizar la inscripción.', 'error')
  } finally {
    isSaving.value = false
  }
}

onMounted(loadEnrollments)

watch(selectedEnrollment, (item) => {
  syncReviewForm(item || null)
})
</script>

<template>
  <div class="admin-module-card">
    <div class="admin-module-toolbar">
      <div class="admin-panel-title">
        <span class="admin-panel-kicker">Inscripciones</span>
        <h3>Solicitudes de inscripción a cursos</h3>
        <p>
          Aquí ves las personas inscritas desde el sitio público, con control de estado y notas
          operativas.
        </p>
      </div>
    </div>

    <p
      v-if="feedbackMessage"
      class="form-feedback admin-feedback"
      :class="feedbackState === 'error' ? 'is-error' : 'is-success'"
    >
      {{ feedbackMessage }}
    </p>

    <div class="admin-toolbar">
      <div class="admin-toolbar-actions">
        <button class="button button-outline" type="button" :disabled="isLoading" @click="loadEnrollments">
          {{ isLoading ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>
    </div>

    <div class="admin-filters-grid">
      <label>
        <span>Estado</span>
        <select v-model="filters.status" @change="loadEnrollments">
          <option value="">Todos</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmada</option>
          <option value="waitlist">Lista de espera</option>
          <option value="cancelled">Cancelada</option>
          <option value="rejected">Rechazada</option>
        </select>
      </label>

      <label class="admin-field-wide">
        <span>Buscar</span>
        <input
          v-model="filters.q"
          type="search"
          placeholder="Nombre, correo, empresa, curso o cohorte"
          @keyup.enter="loadEnrollments"
        />
      </label>
    </div>

    <div v-if="!enrollments.length && !isLoading" class="empty-state">
      Aún no hay solicitudes de inscripción registradas.
    </div>

    <div v-else-if="!filteredEnrollments.length && !isLoading" class="empty-state">
      No hay coincidencias con el filtro actual.
    </div>

    <div v-else class="admin-enrollments-layout">
      <div class="lead-table-wrap">
        <table class="lead-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Curso</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filteredEnrollments"
              :key="item.id"
              :class="{ 'is-active': item.id === selectedEnrollment?.id }"
              @click="selectEnrollment(item.id)"
            >
              <td>
                <strong>{{ item.fullName }}</strong>
                <br />
                <small>{{ item.email }}</small>
              </td>
              <td>
                {{ item.courseTitle }}
                <br />
                <small>{{ item.cohortTitle || item.cohortCode }}</small>
              </td>
              <td>{{ item.status }}</td>
              <td>{{ formatDate(item.enrolledAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <article v-if="selectedEnrollment" class="lead-card lead-detail-card admin-enrollment-detail">
        <div class="lead-card-header">
          <div>
            <strong>{{ selectedEnrollment.fullName }}</strong>
            <a :href="`mailto:${selectedEnrollment.email}`">{{ selectedEnrollment.email }}</a>
          </div>
          <span>{{ formatDate(selectedEnrollment.enrolledAt) }}</span>
        </div>

        <div class="admin-enrollment-meta">
          <div><strong>Curso</strong><span>{{ selectedEnrollment.courseTitle }}</span></div>
          <div><strong>Cohorte</strong><span>{{ selectedEnrollment.cohortTitle || selectedEnrollment.cohortCode }}</span></div>
          <div><strong>Teléfono</strong><span>{{ selectedEnrollment.phone || 'No informado' }}</span></div>
          <div><strong>Empresa</strong><span>{{ selectedEnrollment.company || 'No informada' }}</span></div>
          <div><strong>Documento</strong><span>{{ selectedEnrollment.documentNumber || 'No informado' }}</span></div>
          <div><strong>Fuente</strong><span>{{ selectedEnrollment.source }}</span></div>
        </div>

        <p>{{ selectedEnrollment.message || 'Sin mensaje adicional.' }}</p>

        <div class="admin-form-grid compact-grid">
          <label>
            <span>Estado</span>
            <select v-model="reviewForm.status">
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmada</option>
              <option value="waitlist">Lista de espera</option>
              <option value="cancelled">Cancelada</option>
              <option value="rejected">Rechazada</option>
            </select>
          </label>

          <label class="admin-field-wide">
            <span>Notas internas</span>
            <textarea
              v-model="reviewForm.notes"
              rows="5"
              placeholder="Observaciones comerciales u operativas"
            ></textarea>
          </label>
        </div>

        <div class="admin-enrollment-review">
          <small>
            Revisado:
            {{ selectedEnrollment.reviewedAt ? `${formatDate(selectedEnrollment.reviewedAt)} · ${selectedEnrollment.reviewedByName || 'usuario admin'}` : 'Aún no revisado' }}
          </small>
        </div>

        <div class="admin-form-actions">
          <button class="button button-solid" type="button" :disabled="isSaving" @click="handleSaveReview">
            {{ isSaving ? 'Guardando...' : 'Guardar revisión' }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>
