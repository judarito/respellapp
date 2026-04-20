<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AdminDetailModal from './AdminDetailModal.vue'
import AdminPaginatedListView from './AdminPaginatedListView.vue'
import { apiRequest } from '../../lib/api'

const listViewRef = ref(null)
const isDetailsLoading = ref(false)
const isSavingCourse = ref(false)
const isSavingCohort = ref(false)
const isSavingCategory = ref(false)
const isCourseModalOpen = ref(false)
const feedbackMessage = ref('')
const feedbackState = ref('idle')
const searchDraft = ref('')
const categories = ref([])
const courseDetails = ref(null)
const selectedCourseId = ref(null)
const selectedCohortId = ref(null)

const requestParams = reactive({
  q: '',
})

const categoryForm = reactive({
  name: '',
  slug: '',
  description: '',
})

const courseForm = reactive(createEmptyCourseForm())
const cohortForm = reactive(createEmptyCohortForm())

const selectedCourse = computed(() => courseDetails.value?.course || null)
const selectedCourseCohorts = computed(() => courseDetails.value?.cohorts || [])

function createEmptyCourseForm() {
  return {
    title: '',
    slug: '',
    categoryId: '',
    categoryName: '',
    shortDescription: '',
    description: '',
    learningObjectives: '',
    targetAudience: '',
    modality: 'mixed',
    level: 'all',
    durationHours: 0,
    coverImageUrl: '',
    priceCents: 0,
    currency: 'COP',
    publicationStatus: 'draft',
  }
}

function createEmptyCohortForm() {
  return {
    title: '',
    code: '',
    startDate: '',
    endDate: '',
    enrollmentOpenAt: '',
    enrollmentCloseAt: '',
    capacity: '',
    location: '',
    instructorName: '',
    status: 'draft',
    publicUrl: '',
    priceCents: '',
    currency: 'COP',
  }
}

function syncCourseForm(course) {
  Object.assign(courseForm, createEmptyCourseForm(), {
    title: course?.title || '',
    slug: course?.slug || '',
    categoryId: course?.categoryId ? String(course.categoryId) : '',
    categoryName: course?.categoryName || '',
    shortDescription: course?.shortDescription || '',
    description: course?.description || '',
    learningObjectives: course?.learningObjectives || '',
    targetAudience: course?.targetAudience || '',
    modality: course?.modality || 'mixed',
    level: course?.level || 'all',
    durationHours: Number(course?.durationHours || 0),
    coverImageUrl: course?.coverImageUrl || '',
    priceCents: Number(course?.priceCents || 0),
    currency: course?.currency || 'COP',
    publicationStatus: course?.publicationStatus || 'draft',
  })
}

function syncCohortForm(cohort) {
  Object.assign(cohortForm, createEmptyCohortForm(), {
    title: cohort?.title || '',
    code: cohort?.code || '',
    startDate: cohort?.startDate || '',
    endDate: cohort?.endDate || '',
    enrollmentOpenAt: cohort?.enrollmentOpenAt || '',
    enrollmentCloseAt: cohort?.enrollmentCloseAt || '',
    capacity: cohort?.capacity ?? '',
    location: cohort?.location || '',
    instructorName: cohort?.instructorName || '',
    status: cohort?.status || 'draft',
    publicUrl: cohort?.publicUrl || '',
    priceCents: cohort?.priceCents ?? '',
    currency: cohort?.currency || 'COP',
  })
}

function setFeedback(message, state = 'success') {
  feedbackMessage.value = message
  feedbackState.value = state
}

function clearFeedback() {
  feedbackMessage.value = ''
  feedbackState.value = 'idle'
}

async function loadCategories() {
  const result = await apiRequest('/api/admin/course-categories')
  categories.value = result.items || []
}

async function fetchCoursesPage({ page, pageSize, requestParams: params }) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })

  if (params.q) {
    query.set('q', params.q)
  }

  return apiRequest(`/api/admin/courses?${query.toString()}`)
}

async function loadCourseDetails(courseId) {
  if (!courseId) {
    courseDetails.value = null
    syncCourseForm(null)
    syncCohortForm(null)
    return
  }

  isDetailsLoading.value = true

  try {
    const result = await apiRequest(`/api/admin/courses/${courseId}`)
    courseDetails.value = result.item
    selectedCourseId.value = courseId
    selectedCohortId.value = null
    syncCourseForm(result.item.course)
    syncCohortForm(null)
  } finally {
    isDetailsLoading.value = false
  }
}

function applyFilters() {
  requestParams.q = searchDraft.value.trim()
}

function clearFilters() {
  searchDraft.value = ''
  requestParams.q = ''
}

function startNewCourse() {
  clearFeedback()
  isCourseModalOpen.value = true
  selectedCourseId.value = null
  selectedCohortId.value = null
  courseDetails.value = null
  syncCourseForm(null)
  syncCohortForm(null)
}

async function openCourseDetail(course) {
  clearFeedback()
  isCourseModalOpen.value = true
  selectedCourseId.value = course.id

  try {
    await loadCourseDetails(course.id)
  } catch (error) {
    setFeedback(error.message || 'No fue posible cargar el detalle del curso.', 'error')
  }
}

function closeCourseModal() {
  isCourseModalOpen.value = false
  clearFeedback()
}

function startNewCohort() {
  clearFeedback()
  selectedCohortId.value = null
  syncCohortForm(null)
}

function editCohort(cohort) {
  clearFeedback()
  selectedCohortId.value = cohort.id
  syncCohortForm(cohort)
}

async function handleCreateCategory() {
  clearFeedback()
  isSavingCategory.value = true

  try {
    const result = await apiRequest('/api/admin/course-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(categoryForm),
    })

    categoryForm.name = ''
    categoryForm.slug = ''
    categoryForm.description = ''
    await loadCategories()

    if (result.item?.id) {
      courseForm.categoryId = String(result.item.id)
      courseForm.categoryName = result.item.name
    }

    setFeedback(result.message || 'Categoría creada correctamente.')
  } catch (error) {
    setFeedback(error.message || 'No fue posible crear la categoría.', 'error')
  } finally {
    isSavingCategory.value = false
  }
}

async function handleSaveCourse() {
  clearFeedback()
  isSavingCourse.value = true

  try {
    const payload = {
      ...courseForm,
      categoryId: courseForm.categoryId ? Number(courseForm.categoryId) : null,
      durationHours: Number(courseForm.durationHours || 0),
      priceCents: Number(courseForm.priceCents || 0),
    }

    const endpoint = selectedCourseId.value
      ? `/api/admin/courses/${selectedCourseId.value}`
      : '/api/admin/courses'
    const method = selectedCourseId.value ? 'PUT' : 'POST'

    const result = await apiRequest(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (result.item?.course?.id) {
      selectedCourseId.value = result.item.course.id
      courseDetails.value = result.item
      syncCourseForm(result.item.course)
    }

    await listViewRef.value?.refresh()
    setFeedback(result.message || 'Curso guardado correctamente.')
  } catch (error) {
    setFeedback(error.message || 'No fue posible guardar el curso.', 'error')
  } finally {
    isSavingCourse.value = false
  }
}

async function handleSaveCohort() {
  if (!selectedCourseId.value) {
    setFeedback('Primero debes guardar el curso antes de crear cohortes.', 'error')
    return
  }

  clearFeedback()
  isSavingCohort.value = true

  try {
    const payload = {
      ...cohortForm,
      capacity: cohortForm.capacity === '' ? null : Number(cohortForm.capacity),
      priceCents: cohortForm.priceCents === '' ? null : Number(cohortForm.priceCents),
    }

    const endpoint = selectedCohortId.value
      ? `/api/admin/cohorts/${selectedCohortId.value}`
      : `/api/admin/courses/${selectedCourseId.value}/cohorts`
    const method = selectedCohortId.value ? 'PUT' : 'POST'

    const result = await apiRequest(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    await loadCourseDetails(selectedCourseId.value)

    if (result.item?.id) {
      selectedCohortId.value = result.item.id
      syncCohortForm(result.item)
    }

    await listViewRef.value?.refresh()
    setFeedback(result.message || 'Cohorte guardada correctamente.')
  } catch (error) {
    setFeedback(error.message || 'No fue posible guardar la cohorte.', 'error')
  } finally {
    isSavingCohort.value = false
  }
}

onMounted(async () => {
  try {
    await loadCategories()
  } catch (error) {
    setFeedback(error.message || 'No fue posible cargar las categorías.', 'error')
  }
})
</script>

<template>
  <div class="admin-list-module">
    <AdminPaginatedListView
      ref="listViewRef"
      title="Catálogo de cursos"
      description="El listado es la vista principal. La edición completa del curso y sus cohortes vive en un modal para mantener el foco en la navegación."
      empty-message="Aún no hay cursos creados."
      :fetch-page="fetchCoursesPage"
      :request-params="requestParams"
      :selected-item-id="selectedCourseId"
      :initial-page-size="10"
    >
      <template #header-actions="{ isLoading, refresh }">
        <button class="button button-outline" type="button" :disabled="isLoading" @click="refresh">
          {{ isLoading ? 'Actualizando...' : 'Actualizar cursos' }}
        </button>
        <button class="button button-solid" type="button" @click="startNewCourse">Nuevo curso</button>
      </template>

      <template #filters>
        <div class="admin-filters admin-inline-filters">
          <input
            v-model="searchDraft"
            type="search"
            placeholder="Buscar por título, slug, categoría o estado"
            @keyup.enter="applyFilters"
          />
          <button class="button button-outline" type="button" @click="applyFilters">Buscar</button>
          <button class="button button-ghost" type="button" @click="clearFilters">Limpiar</button>
        </div>
      </template>

      <template #default="{ items }">
        <div class="admin-course-list">
          <button
            v-for="course in items"
            :key="course.id"
            type="button"
            class="admin-course-list-item"
            :class="{ 'is-active': course.id === selectedCourseId && isCourseModalOpen }"
            @click="openCourseDetail(course)"
          >
            <div class="admin-course-list-header">
              <strong>{{ course.title }}</strong>
              <span>{{ course.publicationStatus }}</span>
            </div>
            <small>{{ course.categoryName || 'Sin categoría' }}</small>
            <p>{{ course.shortDescription || 'Sin descripción corta.' }}</p>
            <div class="admin-course-list-meta">
              <span>{{ course.modality }}</span>
              <span>{{ course.durationHours }}h</span>
              <span>{{ course.publishedCohortCount }} cohortes publicadas</span>
            </div>
          </button>
        </div>
      </template>
    </AdminPaginatedListView>

    <AdminDetailModal
      :open="isCourseModalOpen"
      :title="selectedCourse ? selectedCourse.title : 'Nuevo curso'"
      :subtitle="selectedCourse ? 'Edición completa del curso y sus cohortes' : 'Crea un nuevo curso desde el modal de detalle'"
      size="xl"
      @close="closeCourseModal"
    >
      <div class="admin-modal-stack">
        <p
          v-if="feedbackMessage"
          class="form-feedback admin-feedback"
          :class="feedbackState === 'error' ? 'is-error' : 'is-success'"
        >
          {{ feedbackMessage }}
        </p>

        <div v-if="isDetailsLoading" class="empty-state">Cargando detalle del curso...</div>

        <template v-else>
          <section class="admin-form-card">
            <div class="admin-results-header">
              <div>
                <span>Ficha del curso</span>
                <h3>{{ selectedCourse ? selectedCourse.title : 'Nuevo curso' }}</h3>
              </div>
            </div>

            <div class="admin-form-grid">
              <label>
                <span>Título</span>
                <input v-model="courseForm.title" type="text" placeholder="Rescate industrial y vertical" />
              </label>

              <label>
                <span>Slug</span>
                <input v-model="courseForm.slug" type="text" placeholder="rescate-industrial-vertical" />
              </label>

              <label>
                <span>Categoría</span>
                <select v-model="courseForm.categoryId">
                  <option value="">Sin categoría</option>
                  <option v-for="category in categories" :key="category.id" :value="String(category.id)">
                    {{ category.name }}
                  </option>
                </select>
              </label>

              <label>
                <span>Nombre de categoría nueva</span>
                <input v-model="courseForm.categoryName" type="text" placeholder="Trabajo seguro en alturas" />
              </label>

              <label>
                <span>Modalidad</span>
                <select v-model="courseForm.modality">
                  <option value="mixed">Mixta</option>
                  <option value="virtual">Virtual</option>
                  <option value="presential">Presencial</option>
                </select>
              </label>

              <label>
                <span>Nivel</span>
                <input v-model="courseForm.level" type="text" placeholder="avanzado" />
              </label>

              <label>
                <span>Duración en horas</span>
                <input v-model="courseForm.durationHours" type="number" min="0" />
              </label>

              <label>
                <span>Precio en centavos</span>
                <input v-model="courseForm.priceCents" type="number" min="0" />
              </label>

              <label>
                <span>Moneda</span>
                <input v-model="courseForm.currency" type="text" maxlength="3" />
              </label>

              <label>
                <span>Estado</span>
                <select v-model="courseForm.publicationStatus">
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Archivado</option>
                </select>
              </label>

              <label class="admin-field-wide">
                <span>Descripción corta</span>
                <textarea
                  v-model="courseForm.shortDescription"
                  rows="2"
                  placeholder="Resumen comercial que se verá en el catálogo."
                ></textarea>
              </label>

              <label class="admin-field-wide">
                <span>Descripción completa</span>
                <textarea
                  v-model="courseForm.description"
                  rows="5"
                  placeholder="Detalle del curso, alcance, metodología y propuesta de valor."
                ></textarea>
              </label>

              <label class="admin-field-wide">
                <span>Objetivos de aprendizaje</span>
                <textarea
                  v-model="courseForm.learningObjectives"
                  rows="4"
                  placeholder="Objetivos, competencias o resultados esperados."
                ></textarea>
              </label>

              <label class="admin-field-wide">
                <span>Público objetivo</span>
                <textarea
                  v-model="courseForm.targetAudience"
                  rows="3"
                  placeholder="Brigadistas, coordinadores HSEQ, personal operativo..."
                ></textarea>
              </label>

              <label class="admin-field-wide">
                <span>Imagen de portada</span>
                <input v-model="courseForm.coverImageUrl" type="url" placeholder="https://..." />
              </label>
            </div>

            <div class="admin-form-actions">
              <button class="button button-solid" type="button" :disabled="isSavingCourse" @click="handleSaveCourse">
                {{ isSavingCourse ? 'Guardando...' : selectedCourseId ? 'Actualizar curso' : 'Crear curso' }}
              </button>
              <button class="button button-outline" type="button" @click="startNewCourse">Limpiar</button>
            </div>
          </section>

          <section class="admin-form-card">
            <div class="admin-results-header">
              <div>
                <span>Categorías</span>
                <h3>Alta rápida de categorías</h3>
              </div>
            </div>

            <div class="admin-form-grid compact-grid">
              <label>
                <span>Nombre</span>
                <input v-model="categoryForm.name" type="text" placeholder="Rescate industrial" />
              </label>

              <label>
                <span>Slug opcional</span>
                <input v-model="categoryForm.slug" type="text" placeholder="rescate-industrial" />
              </label>

              <label class="admin-field-wide">
                <span>Descripción</span>
                <textarea v-model="categoryForm.description" rows="2"></textarea>
              </label>
            </div>

            <div class="admin-form-actions">
              <button class="button button-outline" type="button" :disabled="isSavingCategory" @click="handleCreateCategory">
                {{ isSavingCategory ? 'Creando...' : 'Crear categoría' }}
              </button>
            </div>
          </section>

          <section class="admin-form-card">
            <div class="admin-results-header">
              <div>
                <span>Cohortes</span>
                <h3>{{ selectedCourse ? `Operación de ${selectedCourse.title}` : 'Guarda un curso para crear cohortes' }}</h3>
              </div>
              <button
                class="button button-outline"
                type="button"
                :disabled="!selectedCourseId || isDetailsLoading"
                @click="startNewCohort"
              >
                Nueva cohorte
              </button>
            </div>

            <div v-if="selectedCourseCohorts.length" class="admin-cohort-list">
              <button
                v-for="cohort in selectedCourseCohorts"
                :key="cohort.id"
                type="button"
                class="admin-cohort-chip"
                :class="{ 'is-active': cohort.id === selectedCohortId }"
                @click="editCohort(cohort)"
              >
                <strong>{{ cohort.title || cohort.code }}</strong>
                <small>{{ cohort.startDate }} · {{ cohort.status }}</small>
              </button>
            </div>

            <div v-if="selectedCourseId" class="admin-form-grid compact-grid">
              <label>
                <span>Título de cohorte</span>
                <input v-model="cohortForm.title" type="text" placeholder="Grupo Mayo 2026" />
              </label>

              <label>
                <span>Código</span>
                <input v-model="cohortForm.code" type="text" placeholder="ALTURAS-0526" />
              </label>

              <label>
                <span>Fecha de inicio</span>
                <input v-model="cohortForm.startDate" type="date" />
              </label>

              <label>
                <span>Fecha de cierre</span>
                <input v-model="cohortForm.endDate" type="date" />
              </label>

              <label>
                <span>Apertura inscripciones</span>
                <input v-model="cohortForm.enrollmentOpenAt" type="date" />
              </label>

              <label>
                <span>Cierre inscripciones</span>
                <input v-model="cohortForm.enrollmentCloseAt" type="date" />
              </label>

              <label>
                <span>Cupos</span>
                <input v-model="cohortForm.capacity" type="number" min="0" />
              </label>

              <label>
                <span>Instructor</span>
                <input v-model="cohortForm.instructorName" type="text" placeholder="Instructor principal" />
              </label>

              <label>
                <span>Ubicación</span>
                <input v-model="cohortForm.location" type="text" placeholder="Bogotá / In company" />
              </label>

              <label>
                <span>Estado</span>
                <select v-model="cohortForm.status">
                  <option value="draft">Borrador</option>
                  <option value="published">Publicada</option>
                  <option value="closed">Cerrada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </label>

              <label>
                <span>Precio cohorte</span>
                <input v-model="cohortForm.priceCents" type="number" min="0" />
              </label>

              <label>
                <span>Moneda</span>
                <input v-model="cohortForm.currency" type="text" maxlength="3" />
              </label>

              <label class="admin-field-wide">
                <span>URL pública opcional</span>
                <input v-model="cohortForm.publicUrl" type="url" placeholder="https://..." />
              </label>
            </div>

            <div v-else class="empty-state">
              Primero crea o selecciona un curso para empezar a administrar sus cohortes.
            </div>

            <div v-if="selectedCourseId" class="admin-form-actions">
              <button class="button button-solid" type="button" :disabled="isSavingCohort" @click="handleSaveCohort">
                {{ isSavingCohort ? 'Guardando...' : selectedCohortId ? 'Actualizar cohorte' : 'Crear cohorte' }}
              </button>
              <button class="button button-outline" type="button" @click="startNewCohort">Limpiar cohorte</button>
            </div>
          </section>
        </template>
      </div>
    </AdminDetailModal>
  </div>
</template>
