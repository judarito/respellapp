<script setup>
import { computed } from 'vue'

const props = defineProps({
  modules: {
    type: Array,
    required: true,
  },
  activeModule: {
    type: String,
    required: true,
  },
  isAuthenticated: {
    type: Boolean,
    required: true,
  },
  user: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['select-module'])

const activeModuleData = computed(
  () => props.modules.find((module) => module.id === props.activeModule) || props.modules[0],
)
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-session-card">
        <span class="admin-session-badge">
          {{ isAuthenticated ? 'Sesión activa' : 'Acceso restringido' }}
        </span>
        <strong>{{ isAuthenticated ? user?.name || user?.email : 'Administrador' }}</strong>
        <p>
          {{ isAuthenticated
            ? `${user?.email} · ${user?.role}`
            : 'Inicia sesión para acceder a los módulos protegidos.' }}
        </p>
      </div>

      <nav class="admin-module-nav" aria-label="Módulos administrativos">
        <button
          v-for="module in modules"
          :key="module.id"
          type="button"
          class="admin-module-button"
          :class="{ 'is-active': module.id === activeModule }"
          @click="emit('select-module', module.id)"
        >
          <span class="admin-module-icon">{{ module.tag }}</span>
          <span class="admin-module-copy">
            <strong>{{ module.label }}</strong>
            <small>{{ module.description }}</small>
          </span>
        </button>
      </nav>
    </aside>

    <section class="admin-workspace">
      <div class="admin-workspace-body">
        <slot />
      </div>
    </section>
  </div>
</template>
