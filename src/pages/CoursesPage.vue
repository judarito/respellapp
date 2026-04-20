<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequest } from '../lib/api'

const isLoading = ref(true)
const courses = ref([])
const errorMessage = ref('')

const hasCourses = computed(() => courses.value.length > 0)

function formatDate(value) {
  if (!value) {
    return 'Fecha por confirmar'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

async function loadCourses() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await apiRequest('/api/courses')
    courses.value = result.items || []
  } catch (error) {
    errorMessage.value = error.message || 'No fue posible cargar el catálogo público.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadCourses)
</script>

<template>
  <div class="page-shell">
    <div class="background-orb orb-one"></div>
    <div class="background-orb orb-two"></div>

    <main class="site-card">
      <header class="topbar">
        <RouterLink class="brand" to="/" aria-label="Ir al inicio de Respell">
          <img src="/respell-logo-header.png" alt="Logo de Respell" class="brand-logo" />
        </RouterLink>

        <nav class="nav-menu" aria-label="Navegación principal">
          <RouterLink to="/">Inicio</RouterLink>
          <RouterLink to="/cursos">Cursos</RouterLink>
          <RouterLink to="/admin">Admin</RouterLink>
        </nav>

        <RouterLink class="button button-solid topbar-cta" to="/#contacto">Solicita información</RouterLink>
      </header>

      <section class="catalog-hero">
        <div class="catalog-hero-copy">
          <span class="eyebrow">Catálogo público</span>
          <h1>Cursos listos para publicar, vender e inscribir</h1>
          <p>
            Esta vista ya consume la API pública y muestra únicamente cursos publicados desde el panel
            administrativo.
          </p>
        </div>
      </section>

      <section class="section section-light">
        <div class="section-heading">
          <span class="eyebrow eyebrow-dark">Oferta académica</span>
          <h2>Explora los cursos de Respell</h2>
          <p>
            Cada ficha puede tener varias cohortes activas, con fechas, cupos y condiciones de
            inscripción independientes.
          </p>
        </div>

        <div v-if="isLoading" class="empty-state">Cargando catálogo...</div>
        <p v-else-if="errorMessage" class="form-feedback is-error">{{ errorMessage }}</p>
        <div v-else-if="!hasCourses" class="empty-state">
          Aún no hay cursos públicos publicados desde el panel administrativo.
        </div>

        <div v-else class="public-courses-grid">
          <article v-for="course in courses" :key="course.id" class="public-course-card">
            <span class="course-type">{{ course.categoryName || 'Curso Respell' }}</span>
            <h3>{{ course.title }}</h3>
            <p>{{ course.shortDescription || 'Curso disponible para publicación y conversión digital.' }}</p>

            <div class="public-course-meta">
              <span>{{ course.modality }}</span>
              <span>{{ course.durationHours }} horas</span>
              <span>{{ course.nextStartDate ? formatDate(course.nextStartDate) : 'Sin cohorte publicada' }}</span>
            </div>

            <div class="public-course-footer">
              <strong>{{ course.priceLabel || 'Valor por confirmar' }}</strong>
              <RouterLink :to="`/cursos/${course.slug}`">Ver detalle</RouterLink>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>
