<script setup>
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'lg',
  },
})

const emit = defineEmits(['close'])

function handleKeydown(event) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    document.body.classList.toggle('admin-modal-open', isOpen)

    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('admin-modal-open')
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <div v-if="open" class="admin-modal-root" @click.self="emit('close')">
    <div class="admin-modal-shell" :class="`is-${size}`">
      <header class="admin-modal-header">
        <div>
          <h3 v-if="title">{{ title }}</h3>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>

        <button class="button button-outline admin-modal-close" type="button" @click="emit('close')">
          Cerrar
        </button>
      </header>

      <div class="admin-modal-body">
        <slot />
      </div>
    </div>
  </div>
</template>
