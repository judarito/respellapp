<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  fetchPage: {
    type: Function,
    required: true,
  },
  requestParams: {
    type: Object,
    default: () => ({}),
  },
  emptyMessage: {
    type: String,
    default: 'No hay elementos disponibles.',
  },
  selectedItemId: {
    type: [Number, String],
    default: null,
  },
  initialPageSize: {
    type: Number,
    default: 10,
  },
  pageSizeOptions: {
    type: Array,
    default: () => [10, 20, 50],
  },
})

const emit = defineEmits(['select', 'loaded', 'error'])

const isLoading = ref(false)
const feedbackMessage = ref('')
const items = ref([])
const pagination = ref({
  page: 1,
  pageSize: props.initialPageSize,
  totalItems: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
})

const normalizedPageSizeOptions = computed(() =>
  Array.from(
    new Set(
      [...props.pageSizeOptions, props.initialPageSize]
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ).sort((left, right) => left - right),
)

async function loadPage(targetPage = pagination.value.page, targetPageSize = pagination.value.pageSize) {
  isLoading.value = true
  feedbackMessage.value = ''

  try {
    const result = await props.fetchPage({
      page: targetPage,
      pageSize: targetPageSize,
      requestParams: props.requestParams,
    })

    items.value = Array.isArray(result?.items) ? result.items : []
    pagination.value = {
      page: Number(result?.pagination?.page || targetPage || 1),
      pageSize: Number(result?.pagination?.pageSize || targetPageSize || props.initialPageSize),
      totalItems: Number(result?.pagination?.totalItems || 0),
      totalPages: Number(result?.pagination?.totalPages || 1),
      hasPreviousPage: Boolean(result?.pagination?.hasPreviousPage),
      hasNextPage: Boolean(result?.pagination?.hasNextPage),
    }

    emit('loaded', { items: items.value, pagination: pagination.value })
  } catch (error) {
    items.value = []
    feedbackMessage.value = error.message || 'No fue posible cargar el listado.'
    emit('error', error)
  } finally {
    isLoading.value = false
  }
}

function refresh() {
  return loadPage(pagination.value.page, pagination.value.pageSize)
}

function goToPage(page) {
  return loadPage(page, pagination.value.pageSize)
}

function updatePageSize(event) {
  const nextPageSize = Number(event.target.value) || props.initialPageSize
  return loadPage(1, nextPageSize)
}

watch(
  () => props.requestParams,
  async () => {
    await loadPage(1, pagination.value.pageSize)
  },
  { deep: true },
)

onMounted(async () => {
  await loadPage(1, props.initialPageSize)
})

defineExpose({
  refresh,
  goToPage,
})
</script>

<template>
  <div class="admin-module-card admin-listview-card">
    <div class="admin-listview-header">
      <div class="admin-panel-title">
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>

      <div class="admin-listview-actions">
        <slot
          name="header-actions"
          :is-loading="isLoading"
          :pagination="pagination"
          :refresh="refresh"
        />
      </div>
    </div>

    <p v-if="feedbackMessage" class="form-feedback admin-feedback is-error">
      {{ feedbackMessage }}
    </p>

    <div class="admin-listview-toolbar">
      <slot
        name="filters"
        :is-loading="isLoading"
        :pagination="pagination"
        :refresh="refresh"
      />
    </div>

    <div v-if="isLoading && !items.length" class="empty-state">
      Cargando listado...
    </div>

    <div v-else-if="!items.length" class="empty-state">
      <slot name="empty">{{ emptyMessage }}</slot>
    </div>

    <div v-else class="admin-listview-body">
      <slot
        :items="items"
        :is-loading="isLoading"
        :pagination="pagination"
        :selected-item-id="selectedItemId"
        :refresh="refresh"
      />
    </div>

    <div class="admin-listview-footer">
      <div class="admin-listview-footer-copy">
        <strong>{{ pagination.totalItems }}</strong>
        <span>{{ pagination.totalItems === 1 ? 'registro total' : 'registros totales' }}</span>
      </div>

      <div class="admin-listview-footer-controls">
        <label class="admin-listview-page-size">
          <span>Por página</span>
          <select :value="pagination.pageSize" @change="updatePageSize">
            <option v-for="size in normalizedPageSizeOptions" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
        </label>

        <div class="admin-listview-pagination">
          <button
            class="button button-outline"
            type="button"
            :disabled="isLoading || !pagination.hasPreviousPage"
            @click="goToPage(pagination.page - 1)"
          >
            Anterior
          </button>

          <span>Página {{ pagination.page }} de {{ pagination.totalPages }}</span>

          <button
            class="button button-outline"
            type="button"
            :disabled="isLoading || !pagination.hasNextPage"
            @click="goToPage(pagination.page + 1)"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
