import { ref } from 'vue'
import { apiRequest } from '../lib/api'

const authUser = ref(null)
const authMessage = ref('')
const authState = ref('idle')
const isAuthLoading = ref(false)

export function useAuth() {
  async function loadSession() {
    try {
      const result = await apiRequest('/api/auth/session')
      authUser.value = result.user
      authState.value = 'success'
      authMessage.value = ''
      return result.user
    } catch {
      authUser.value = null
      return null
    }
  }

  async function login(email, password) {
    authMessage.value = ''
    authState.value = 'idle'
    isAuthLoading.value = true

    try {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      authUser.value = result.user
      authState.value = 'success'
      authMessage.value = result.message || 'Sesión iniciada correctamente.'
      return result.user
    } catch (error) {
      authState.value = 'error'
      authMessage.value = error.message || 'No fue posible iniciar sesión.'
      throw error
    } finally {
      isAuthLoading.value = false
    }
  }

  async function logout() {
    isAuthLoading.value = true

    try {
      const result = await apiRequest('/api/auth/logout', {
        method: 'POST',
      })

      authUser.value = null
      authState.value = 'success'
      authMessage.value = result.message || 'Sesión cerrada correctamente.'
      return true
    } catch (error) {
      authState.value = 'error'
      authMessage.value = error.message || 'No fue posible cerrar sesión.'
      throw error
    } finally {
      isAuthLoading.value = false
    }
  }

  function clearAuthFeedback() {
    authMessage.value = ''
    authState.value = 'idle'
  }

  return {
    authUser,
    authMessage,
    authState,
    isAuthLoading,
    loadSession,
    login,
    logout,
    clearAuthFeedback,
  }
}
