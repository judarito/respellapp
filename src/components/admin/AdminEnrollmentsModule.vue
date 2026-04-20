<script setup>
import { reactive, ref } from 'vue'
import AdminDetailModal from './AdminDetailModal.vue'
import AdminPaginatedListView from './AdminPaginatedListView.vue'
import { apiRequest } from '../../lib/api'

const listViewRef = ref(null)
const isSaving = ref(false)
const feedbackMessage = ref('')
const feedbackState = ref('idle')
const selectedEnrollment = ref(null)
const searchDraft = ref('')

const requestParams = reactive({
  status: '',
  q: '',
})

const reviewForm = reactive({
  status: 'pending',
  notes: '',
})

function setFeedback(message, state = 'success') {
  feedbackMessage.value = message
  feedbackState.value = state
}

function syncReviewForm(item) {
  reviewForm.status = item?.status || 'pending'
  reviewForm.notes = item?.notes || ''
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

async function fetchEnrollmentsPage({ page, pageSize, requestParams: params }) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })

  if (params.status) {
    query.set('status', params.status)
  }

  if (params.q) {
    query.set('q', params.q)
  }

  return apiRequest(`/api/admin/enrollments?${query.toString()}`)
}

function applyFilters() {
  requestParams.q = searchDraft.value.trim()
}

function clearFilters() {
  searchDraft.value = ''
  requestParams.q = ''
  requestParams.status = ''
}

function openEnrollmentDetail(item) {
  selectedEnrollment.value = item
  syncReviewForm(item)
  feedbackMessage.value = ''
  feedbackState.value = 'idle'
}

function closeEnrollmentDetail() {
  selectedEnrollment.value = null
  syncReviewForm(null)
  feedbackMessage.value = ''
  feedbackState.value = 'idle'
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

    selectedEnrollment.value = result.item
    syncReviewForm(result.item)
    setFeedback(result.message || 'Inscripción actualizada correctamente.')
    await listViewRef.value?.refresh()
  } catch (error) {
    setFeedback(error.message || 'No fue posible actualizar la inscripción.', 'error')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="admin-list-module">
    <AdminPaginatedListView
      ref="listViewRef"
      title="Solicitudes de inscripción"
      description="El módulo muestra primero el listado paginado y abre el detalle en una capa aparte para mantener la vista limpia."
      empty-message="Aún no hay solicitudes de inscripción registradas."
      :fetch-page="fetchEnrollmentsPage"
      :request-params="requestParams"
      :selected-item-id="selectedEnrollment?.id"
      :initial-page-size="10"
    >
      <template #header-actions="{ isLoading, refresh }">
        <button class="button button-outline" type="button" :disabled="isLoading" @click="refresh">
          {{ isLoading ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </template>

      <template #filters>
        <div class="admin-filters-grid admin-listview-filters-grid">
          <label>
            <span>Estado</span>
            <select v-model="requestParams.status">
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
            <div class="admin-inline-filters">
              <input
                v-model="searchDraft"
                type="search"
                placeholder="Nombre, correo, empresa, curso o cohorte"
                @keyup.enter="applyFilters"
              />
              <button class="button button-outline" type="button" @click="applyFilters">Buscar</button>
              <button class="button button-ghost" type="button" @click="clearFilters">Limpiar</button>
            </div>
          </label>
        </div>
      </template>

      <template #default="{ items }">
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
                v-for="item in items"
                :key="item.id"
                :class="{ 'is-active': item.id === selectedEnrollment?.id }"
                @click="openEnrollmentDetail(item)"
              >
                <td data-label="Persona">
                  <strong>{{ item.fullName }}</strong>
                  <br />
                  <small>{{ item.email }}</small>
                </td>
                <td data-label="Curso">
                  {{ item.courseTitle }}
                  <br />
                  <small>{{ item.cohortTitle || item.cohortCode }}</small>
                </td>
                <td data-label="Estado">{{ item.status }}</td>
                <td data-label="Fecha">{{ formatDate(item.enrolledAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </AdminPaginatedListView>

    <AdminDetailModal
      :open="Boolean(selectedEnrollment)"
      :title="selectedEnrollment?.fullName || 'Detalle de inscripción'"
      :subtitle="selectedEnrollment?.courseTitle || ''"
      size="xl"
      @close="closeEnrollmentDetail"
    >
      <div v-if="selectedEnrollment" class="admin-modal-stack">
        <p
          v-if="feedbackMessage"
          class="form-feedback admin-feedback"
          :class="feedbackState === 'error' ? 'is-error' : 'is-success'"
        >
          {{ feedbackMessage }}
        </p>

        <article class="lead-card lead-detail-card admin-enrollment-detail">
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
    </AdminDetailModal>
  </div>
</template>
