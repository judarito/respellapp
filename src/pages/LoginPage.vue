<script setup>
import { onMounted, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AdminLoginPanel from '../components/admin/AdminLoginPanel.vue'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const loginForm = reactive({
  email: '',
  password: '',
})

const { authMessage, authState, authUser, clearAuthFeedback, isAuthLoading, loadSession, login } =
  useAuth()

async function handleLogin() {
  try {
    await login(loginForm.email, loginForm.password)
    loginForm.password = ''
    await router.push('/admin')
  } catch {
    // Error message is already managed by the auth composable.
  }
}

onMounted(async () => {
  clearAuthFeedback()
  const user = await loadSession()

  if (user) {
    await router.replace('/admin')
  }
})
</script>

<template>
  <div class="route-shell route-auth-shell">
    <div class="background-orb orb-one"></div>
    <div class="background-orb orb-two"></div>

    <div class="auth-page-card">
      <div class="auth-page-copy">
        <span class="auth-route-kicker">Respell Admin</span>
        <h1>Acceso al panel de gestión comercial y operativa</h1>
        <p>
          Desde aquí podrás actualizar la información del sitio, gestionar cursos y dar
          seguimiento a solicitudes e inscripciones del negocio.
        </p>

        <div class="auth-route-actions">
          <RouterLink class="button button-outline" to="/">Volver al sitio</RouterLink>
          <RouterLink v-if="authUser" class="button button-solid" to="/admin">Ir al admin</RouterLink>
        </div>
      </div>

      <div class="auth-page-panel">
        <AdminLoginPanel
          :email="loginForm.email"
          :password="loginForm.password"
          :is-loading="isAuthLoading"
          @update:email="loginForm.email = $event"
          @update:password="loginForm.password = $event"
          @submit="handleLogin"
        />

        <p
          v-if="authMessage"
          class="form-feedback auth-page-feedback"
          :class="authState === 'error' ? 'is-error' : 'is-success'"
        >
          {{ authMessage }}
        </p>
      </div>
    </div>
  </div>
</template>
