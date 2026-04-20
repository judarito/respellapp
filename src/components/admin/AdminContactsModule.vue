<script setup>
import { reactive, ref } from 'vue'
import AdminDetailModal from './AdminDetailModal.vue'
import AdminPaginatedListView from './AdminPaginatedListView.vue'
import { apiRequest } from '../../lib/api'

const listViewRef = ref(null)
const selectedLead = ref(null)
const searchDraft = ref('')
const requestParams = reactive({
  q: '',
})

async function fetchLeadsPage({ page, pageSize, requestParams: params }) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })

  if (params.q) {
    query.set('q', params.q)
  }

  return apiRequest(`/api/admin/contact-requests?${query.toString()}`)
}

function applyFilters() {
  requestParams.q = searchDraft.value.trim()
}

function clearFilters() {
  searchDraft.value = ''
  requestParams.q = ''
}

function openLeadDetail(lead) {
  selectedLead.value = lead
}

function closeLeadDetail() {
  selectedLead.value = null
}
</script>

<template>
  <div class="admin-list-module">
    <AdminPaginatedListView
      ref="listViewRef"
      title="Listado de leads"
      description="Vista principal de solicitudes web. Desde aquí abrimos el detalle sin dividir la pantalla en dos columnas."
      empty-message="Aún no hay solicitudes registradas."
      :fetch-page="fetchLeadsPage"
      :request-params="requestParams"
      :selected-item-id="selectedLead?.id"
      :initial-page-size="10"
    >
      <template #header-actions="{ isLoading, refresh }">
        <button class="button button-outline" type="button" :disabled="isLoading" @click="refresh">
          {{ isLoading ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </template>

      <template #filters>
        <div class="admin-filters admin-inline-filters">
          <input
            v-model="searchDraft"
            type="search"
            placeholder="Buscar por nombre, correo, mensaje o fuente"
            @keyup.enter="applyFilters"
          />
          <button class="button button-outline" type="button" @click="applyFilters">Buscar</button>
          <button class="button button-ghost" type="button" @click="clearFilters">Limpiar</button>
        </div>
      </template>

      <template #default="{ items }">
        <div class="lead-table-wrap">
          <table class="lead-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="lead in items"
                :key="lead.id"
                :class="{ 'is-active': lead.id === selectedLead?.id }"
                @click="openLeadDetail(lead)"
              >
                <td data-label="Nombre">{{ lead.name }}</td>
                <td data-label="Correo">{{ lead.email }}</td>
                <td data-label="Fecha">{{ lead.created_at }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </AdminPaginatedListView>

    <AdminDetailModal
      :open="Boolean(selectedLead)"
      :title="selectedLead?.name || 'Detalle del lead'"
      :subtitle="selectedLead?.email || ''"
      size="md"
      @close="closeLeadDetail"
    >
      <article v-if="selectedLead" class="lead-card lead-detail-card">
        <div class="lead-card-header">
          <div>
            <strong>{{ selectedLead.name }}</strong>
            <a :href="`mailto:${selectedLead.email}`">{{ selectedLead.email }}</a>
          </div>
          <span>{{ selectedLead.created_at }}</span>
        </div>
        <p>{{ selectedLead.message }}</p>
        <small>{{ selectedLead.source }}</small>
      </article>
    </AdminDetailModal>
  </div>
</template>
