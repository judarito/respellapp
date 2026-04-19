<script setup>
defineProps({
  isLoading: {
    type: Boolean,
    default: false,
  },
  leads: {
    type: Array,
    required: true,
  },
  filteredLeads: {
    type: Array,
    required: true,
  },
  selectedLead: {
    type: Object,
    default: null,
  },
  search: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:search', 'select-lead'])
</script>

<template>
  <div class="admin-module-card">
    <div class="admin-module-toolbar">
      <div class="admin-panel-title">
        <span class="admin-panel-kicker">Leads</span>
        <h3>Listado de `contact_requests`</h3>
        <p>Primer módulo real del admin, diseñado para crecer con filtros, estados y seguimiento.</p>
      </div>
    </div>

    <div class="admin-filters">
      <input
        :value="search"
        type="search"
        placeholder="Buscar por nombre, correo, mensaje o fuente"
        @input="emit('update:search', $event.target.value)"
      />
    </div>

    <div v-if="!leads.length && !isLoading" class="empty-state">
      Aún no hay solicitudes registradas.
    </div>

    <div v-else-if="!filteredLeads.length && !isLoading" class="empty-state">
      No hay coincidencias para la búsqueda actual.
    </div>

    <div v-else class="admin-leads-layout">
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
              v-for="lead in filteredLeads"
              :key="lead.id"
              :class="{ 'is-active': lead.id === selectedLead?.id }"
              @click="emit('select-lead', lead.id)"
            >
              <td>{{ lead.name }}</td>
              <td>{{ lead.email }}</td>
              <td>{{ lead.created_at }}</td>
            </tr>
          </tbody>
        </table>
      </div>

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
    </div>
  </div>
</template>
