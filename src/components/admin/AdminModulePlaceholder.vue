<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="admin-module-card admin-placeholder-card">
    <div class="admin-panel-title">
      <span class="admin-panel-kicker">Próximo módulo</span>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>

    <div class="admin-placeholder-grid">
      <div>Layout listo para vistas hijas</div>
      <div>Espacio para endpoints protegidos</div>
      <div>Estructura preparada para CRUD</div>
      <div>Mismo lenguaje visual del resto de la app</div>
    </div>
  </div>
</template>
