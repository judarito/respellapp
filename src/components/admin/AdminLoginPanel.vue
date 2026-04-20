<script setup>
const props = defineProps({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:email', 'update:password', 'submit'])
</script>

<template>
  <form class="admin-login-panel" @submit.prevent="emit('submit')">
    <div class="admin-panel-title">
      <span class="admin-panel-kicker">Acceso</span>
      <h3>Inicio de sesión administrativo</h3>
      <p>Autenticación protegida por backend y sesión persistida con cookie HttpOnly.</p>
    </div>

    <input
      :value="email"
      type="email"
      placeholder="Correo del administrador"
      autocomplete="username"
      required
      @input="emit('update:email', $event.target.value)"
    />
    <input
      :value="password"
      type="password"
      placeholder="Contraseña"
      autocomplete="current-password"
      required
      @input="emit('update:password', $event.target.value)"
    />

    <button class="button button-solid button-full" type="submit" :disabled="isLoading">
      {{ isLoading ? 'Ingresando...' : 'Iniciar sesión' }}
    </button>

    <p class="admin-helper">
      Usa el usuario creado con `npm run create:admin -- correo@dominio.com tu-contraseña`.
    </p>
  </form>
</template>
