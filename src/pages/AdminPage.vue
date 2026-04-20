<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AdminContactsModule from '../components/admin/AdminContactsModule.vue'
import AdminCoursesModule from '../components/admin/AdminCoursesModule.vue'
import AdminEnrollmentsModule from '../components/admin/AdminEnrollmentsModule.vue'
import AdminLandingModule from '../components/admin/AdminLandingModule.vue'
import AdminLayout from '../components/admin/AdminLayout.vue'
import AdminModulePlaceholder from '../components/admin/AdminModulePlaceholder.vue'
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

const { authMessage, authState, authUser, clearAuthFeedback, isAuthLoading, loadSession, logout } =
  useAuth()

const activeAdminModuleData = computed(
  () => adminModules.find((module) => module.id === activeAdminModule.value) || adminModules[0],
)

async function handleLogout() {
  try {
    await logout()
  } finally {
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
          </div>

          <AdminContactsModule v-if="activeAdminModule === 'contacts'" />

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
