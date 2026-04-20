<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AdminContactsModule from '../components/admin/AdminContactsModule.vue'
import AdminCoursesModule from '../components/admin/AdminCoursesModule.vue'
import AdminEnrollmentsModule from '../components/admin/AdminEnrollmentsModule.vue'
import AdminLandingModule from '../components/admin/AdminLandingModule.vue'
import AdminLayout from '../components/admin/AdminLayout.vue'
import AdminModulePlaceholder from '../components/admin/AdminModulePlaceholder.vue'
import { apiRequest } from '../lib/api'
import { useAuth } from '../composables/useAuth'

const router = useRouter()

const adminModules = [
  {
    id: 'landing',
    tag: 'LP',
    label: 'Landing',
    description: 'Hero y secciones',
    longDescription:
      'Administración del contenido comercial del sitio público: hero, contacto, servicios, métricas, testimonios y bloques de valor.',
  },
  {
    id: 'contacts',
    tag: 'LD',
    label: 'Leads',
    description: 'Solicitudes web',
    longDescription:
      'Gestión inicial de solicitudes recibidas desde la landing. Desde aquí podemos evolucionar hacia seguimiento comercial, estados y responsables.',
  },
  {
    id: 'courses',
    tag: 'CU',
    label: 'Cursos',
    description: 'Catálogo y cohortes',
    longDescription:
      'Módulo para creación, publicación y operación académica de cursos, instructores, temarios y cohortes.',
  },
  {
    id: 'enrollments',
    tag: 'IN',
    label: 'Inscripciones',
    description: 'Solicitudes y estados',
    longDescription:
      'Revisión operativa de personas inscritas desde el sitio público, con cambios de estado, notas y seguimiento.',
  },
  {
    id: 'sales',
    tag: 'VT',
    label: 'Ventas',
    description: 'Órdenes y pagos',
    longDescription:
      'Espacio previsto para ventas online, checkout, estados de orden e integraciones con la operación comercial.',
  },
  {
    id: 'users',
    tag: 'US',
    label: 'Usuarios',
    description: 'Roles y permisos',
    longDescription:
      'Módulo reservado para administración de accesos, roles, permisos y auditoría básica del panel.',
  },
]

const activeAdminModule = ref('landing')
const isLeadsLoading = ref(false)
const hasLoadedLeads = ref(false)
const leads = ref([])
const leadsSearch = ref('')
const selectedLeadId = ref(null)

const { authMessage, authState, authUser, clearAuthFeedback, isAuthLoading, loadSession, logout } =
  useAuth()

const activeAdminModuleData = computed(
  () => adminModules.find((module) => module.id === activeAdminModule.value) || adminModules[0],
)
const filteredLeads = computed(() => {
  const query = leadsSearch.value.trim().toLowerCase()

  if (!query) {
    return leads.value
  }

  return leads.value.filter((lead) =>
    [lead.name, lead.email, lead.message, lead.source]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  )
})
const selectedLead = computed(() => {
  if (!filteredLeads.value.length) {
    return null
  }

  return (
    filteredLeads.value.find((lead) => lead.id === selectedLeadId.value) || filteredLeads.value[0]
  )
})

async function loadLeads() {
  isLeadsLoading.value = true

  try {
    const result = await apiRequest('/api/admin/contact-requests')
    leads.value = result.items || []
    selectedLeadId.value = result.items?.[0]?.id || null
    hasLoadedLeads.value = true
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes('iniciar sesión')) {
      leads.value = []
      await router.replace('/login')
    }
  } finally {
    isLeadsLoading.value = false
  }
}

async function handleLogout() {
  try {
    await logout()
  } finally {
    leads.value = []
    hasLoadedLeads.value = false
    await router.push('/login')
  }
}

onMounted(async () => {
  clearAuthFeedback()
  const user = await loadSession()

  if (!user) {
    await router.replace('/login')
    return
  }
})

watch(activeAdminModule, async (moduleId) => {
  if (moduleId === 'contacts' && !hasLoadedLeads.value && !isLeadsLoading.value) {
    await loadLeads()
  }
})
</script>

<template>
  <div class="route-shell route-admin-shell">
    <div class="admin-route-topbar">
      <RouterLink class="brand admin-route-brand" to="/">
        <img src="/respell-logo-header.png" alt="Logo de Respell" class="brand-logo" />
      </RouterLink>

      <div class="admin-route-actions">
        <RouterLink class="button button-outline" to="/">Ver sitio público</RouterLink>
        <button class="button button-solid" type="button" :disabled="isAuthLoading" @click="handleLogout">
          Cerrar sesión
        </button>
      </div>
    </div>

    <section class="admin-route-content">
      <AdminLayout
        :modules="adminModules"
        :active-module="activeAdminModule"
        :is-authenticated="Boolean(authUser)"
        :user="authUser"
        @select-module="activeAdminModule = $event"
      >
        <div class="admin-module-stack">
          <div class="admin-toolbar">
            <div>
              <strong>{{ authUser?.email }}</strong>
              <span>{{ authUser?.role }}</span>
            </div>
            <div class="admin-toolbar-actions">
              <button
                v-if="activeAdminModule === 'contacts'"
                class="button button-outline"
                type="button"
                :disabled="isLeadsLoading"
                @click="loadLeads"
              >
                {{ isLeadsLoading ? 'Actualizando...' : 'Actualizar' }}
              </button>
            </div>
          </div>

          <AdminContactsModule
            v-if="activeAdminModule === 'contacts'"
            :is-loading="isLeadsLoading"
            :leads="leads"
            :filtered-leads="filteredLeads"
            :selected-lead="selectedLead"
            :search="leadsSearch"
            @update:search="leadsSearch = $event"
            @select-lead="selectedLeadId = $event"
          />

          <AdminLandingModule v-else-if="activeAdminModule === 'landing'" />

          <AdminCoursesModule v-else-if="activeAdminModule === 'courses'" />

          <AdminEnrollmentsModule v-else-if="activeAdminModule === 'enrollments'" />

          <AdminModulePlaceholder
            v-else
            :title="activeAdminModuleData.label"
            :description="activeAdminModuleData.longDescription"
          />
        </div>
      </AdminLayout>

      <p
        v-if="authMessage"
        class="form-feedback admin-feedback"
        :class="authState === 'error' ? 'is-error' : 'is-success'"
      >
        {{ authMessage }}
      </p>
    </section>
  </div>
</template>
