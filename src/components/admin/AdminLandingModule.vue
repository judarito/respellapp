<script setup>
import { onMounted, reactive, ref } from 'vue'
import { apiRequest } from '../../lib/api'

const isLoading = ref(false)
const isSaving = ref(false)
const isUploadingHero = ref(false)
const feedbackMessage = ref('')
const feedbackState = ref('idle')

const landingForm = reactive(createDefaultLandingForm())

function createDefaultLandingForm() {
  return {
    settings: {
      companyName: 'Respell',
      legalName: 'Rescate - Rapelling S.A.S',
      tagline: '',
      servicesEyebrow: 'Nuestros servicios',
      servicesTitle: 'Un sitio pensado para vender confianza operativa',
      testimonialsEyebrow: 'Testimonios',
      testimonialsTitle: 'La estructura visual sigue la referencia y se adapta a una propuesta comercial real',
      coursesEyebrow: 'Cursos destacados',
      coursesTitle: 'Catálogo público conectado a los cursos publicados',
      platformEyebrow: 'Plataforma',
      platformTitle: 'Base funcional para crecer hacia gestión académica y ventas online',
      contactEyebrow: 'Solicita información',
      contactTitle: 'Landing comercial con enfoque en conversión',
      primaryEmail: '',
      secondaryEmail: '',
      primaryPhone: '',
      secondaryPhone: '',
      whatsappNumber: '',
      address: '',
      footerText: '',
    },
    hero: {
      eyebrow: '',
      title: '',
      subtitle: '',
      primaryCtaLabel: 'Ver cursos',
      primaryCtaUrl: '/cursos',
      secondaryCtaLabel: 'Ver plataforma',
      secondaryCtaUrl: '#plataforma',
      chipTop: '',
      chipBottom: '',
      backgroundImageUrl: '',
      isPublished: true,
    },
    services: [],
    testimonials: [],
    metrics: [],
    featureBlocks: [],
  }
}

function createServiceItem(order = 1) {
  return {
    title: '',
    description: '',
    icon: 'S',
    displayOrder: order,
    isActive: true,
  }
}

function createTestimonialItem(order = 1) {
  return {
    companyName: '',
    quote: '',
    authorName: '',
    rating: 5,
    displayOrder: order,
    isActive: true,
  }
}

function createMetricItem(order = 1) {
  return {
    value: '',
    label: '',
    displayOrder: order,
    isActive: true,
  }
}

function createFeatureBlockItem(order = 1) {
  return {
    eyebrow: '',
    title: '',
    text: '',
    bulletsText: '',
    displayOrder: order,
    isActive: true,
  }
}

function setFeedback(message, state = 'success') {
  feedbackMessage.value = message
  feedbackState.value = state
}

function assignLandingContent(payload) {
  const defaults = createDefaultLandingForm()

  Object.assign(landingForm.settings, defaults.settings, payload?.settings || {})
  Object.assign(landingForm.hero, defaults.hero, payload?.hero || {})

  landingForm.services.splice(
    0,
    landingForm.services.length,
    ...((payload?.services || []).map((item, index) => ({
      ...createServiceItem(index + 1),
      ...item,
    })) || []),
  )

  landingForm.testimonials.splice(
    0,
    landingForm.testimonials.length,
    ...((payload?.testimonials || []).map((item, index) => ({
      ...createTestimonialItem(index + 1),
      ...item,
    })) || []),
  )

  landingForm.metrics.splice(
    0,
    landingForm.metrics.length,
    ...((payload?.metrics || []).map((item, index) => ({
      ...createMetricItem(index + 1),
      ...item,
    })) || []),
  )

  landingForm.featureBlocks.splice(
    0,
    landingForm.featureBlocks.length,
    ...((payload?.featureBlocks || []).map((item, index) => ({
      ...createFeatureBlockItem(index + 1),
      ...item,
    })) || []),
  )

  if (!landingForm.services.length) {
    landingForm.services.push(createServiceItem(1))
  }

  if (!landingForm.testimonials.length) {
    landingForm.testimonials.push(createTestimonialItem(1))
  }

  if (!landingForm.metrics.length) {
    landingForm.metrics.push(createMetricItem(1))
  }

  if (!landingForm.featureBlocks.length) {
    landingForm.featureBlocks.push(createFeatureBlockItem(1))
  }
}

async function loadLandingContent() {
  isLoading.value = true

  try {
    const result = await apiRequest('/api/admin/landing-content')
    assignLandingContent(result)
  } catch (error) {
    setFeedback(error.message || 'No fue posible cargar la configuración de la landing.', 'error')
  } finally {
    isLoading.value = false
  }
}

async function handleSave() {
  isSaving.value = true
  feedbackMessage.value = ''
  feedbackState.value = 'idle'

  try {
    const payload = {
      settings: { ...landingForm.settings },
      hero: { ...landingForm.hero },
      services: landingForm.services.map((item) => ({
        title: item.title,
        description: item.description,
        icon: item.icon,
        displayOrder: Number(item.displayOrder || 0),
        isActive: Boolean(item.isActive),
      })),
      testimonials: landingForm.testimonials.map((item) => ({
        companyName: item.companyName,
        quote: item.quote,
        authorName: item.authorName,
        rating: Number(item.rating || 5),
        displayOrder: Number(item.displayOrder || 0),
        isActive: Boolean(item.isActive),
      })),
      metrics: landingForm.metrics.map((item) => ({
        value: item.value,
        label: item.label,
        displayOrder: Number(item.displayOrder || 0),
        isActive: Boolean(item.isActive),
      })),
      featureBlocks: landingForm.featureBlocks.map((item) => ({
        eyebrow: item.eyebrow,
        title: item.title,
        text: item.text,
        bulletsText: item.bulletsText,
        displayOrder: Number(item.displayOrder || 0),
        isActive: Boolean(item.isActive),
      })),
    }

    const result = await apiRequest('/api/admin/landing-content', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    assignLandingContent(result)
    setFeedback(result.message || 'Contenido de la landing actualizado correctamente.')
  } catch (error) {
    setFeedback(error.message || 'No fue posible guardar la landing.', 'error')
  } finally {
    isSaving.value = false
  }
}

async function handleHeroImageSelected(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  isUploadingHero.value = true

  try {
    const fileDataUrl = await readFileAsDataUrl(file)
    const result = await apiRequest('/api/admin/uploads/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileDataUrl,
        fileName: file.name,
        folder: 'respell/landing/hero',
      }),
    })

    landingForm.hero.backgroundImageUrl = result.item?.secureUrl || ''
    setFeedback('Imagen del hero subida correctamente.')
  } catch (error) {
    setFeedback(error.message || 'No fue posible subir la imagen.', 'error')
  } finally {
    isUploadingHero.value = false
    event.target.value = ''
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No fue posible leer el archivo seleccionado.'))
    reader.readAsDataURL(file)
  })
}

function addService() {
  landingForm.services.push(createServiceItem(landingForm.services.length + 1))
}

function removeService(index) {
  landingForm.services.splice(index, 1)
}

function addTestimonial() {
  landingForm.testimonials.push(createTestimonialItem(landingForm.testimonials.length + 1))
}

function removeTestimonial(index) {
  landingForm.testimonials.splice(index, 1)
}

function addMetric() {
  landingForm.metrics.push(createMetricItem(landingForm.metrics.length + 1))
}

function removeMetric(index) {
  landingForm.metrics.splice(index, 1)
}

function addFeatureBlock() {
  landingForm.featureBlocks.push(createFeatureBlockItem(landingForm.featureBlocks.length + 1))
}

function removeFeatureBlock(index) {
  landingForm.featureBlocks.splice(index, 1)
}

onMounted(loadLandingContent)
</script>

<template>
  <div class="admin-module-card">
    <div class="admin-module-toolbar">
      <div class="admin-panel-title">
        <span class="admin-panel-kicker">Landing</span>
        <h3>Contenido dinámico del sitio público</h3>
        <p>
          Aquí administras el hero, contacto, servicios, testimonios, métricas y bloques de la
          landing, además de subir la imagen principal a Cloudinary.
        </p>
      </div>
    </div>

    <p
      v-if="feedbackMessage"
      class="form-feedback admin-feedback"
      :class="feedbackState === 'error' ? 'is-error' : 'is-success'"
    >
      {{ feedbackMessage }}
    </p>

    <div class="admin-toolbar">
      <div class="admin-toolbar-actions">
        <button class="button button-outline" type="button" :disabled="isLoading" @click="loadLandingContent">
          {{ isLoading ? 'Actualizando...' : 'Recargar contenido' }}
        </button>
        <button class="button button-solid" type="button" :disabled="isSaving" @click="handleSave">
          {{ isSaving ? 'Guardando...' : 'Guardar landing' }}
        </button>
      </div>
    </div>

    <div class="admin-form-sections">
      <section class="admin-form-card">
        <div class="admin-results-header">
          <div>
            <span>Configuración general</span>
            <h3>Empresa, contacto y footer</h3>
          </div>
        </div>

        <div class="admin-form-grid">
          <label>
            <span>Nombre comercial</span>
            <input v-model="landingForm.settings.companyName" type="text" />
          </label>
          <label>
            <span>Razón social</span>
            <input v-model="landingForm.settings.legalName" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>Tagline</span>
            <input v-model="landingForm.settings.tagline" type="text" />
          </label>
          <label>
            <span>Eyebrow servicios</span>
            <input v-model="landingForm.settings.servicesEyebrow" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>Título servicios</span>
            <input v-model="landingForm.settings.servicesTitle" type="text" />
          </label>
          <label>
            <span>Eyebrow testimonios</span>
            <input v-model="landingForm.settings.testimonialsEyebrow" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>Título testimonios</span>
            <input v-model="landingForm.settings.testimonialsTitle" type="text" />
          </label>
          <label>
            <span>Eyebrow cursos</span>
            <input v-model="landingForm.settings.coursesEyebrow" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>Título cursos</span>
            <input v-model="landingForm.settings.coursesTitle" type="text" />
          </label>
          <label>
            <span>Eyebrow plataforma</span>
            <input v-model="landingForm.settings.platformEyebrow" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>Título plataforma</span>
            <input v-model="landingForm.settings.platformTitle" type="text" />
          </label>
          <label>
            <span>Eyebrow contacto</span>
            <input v-model="landingForm.settings.contactEyebrow" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>Título contacto</span>
            <input v-model="landingForm.settings.contactTitle" type="text" />
          </label>
          <label>
            <span>Correo principal</span>
            <input v-model="landingForm.settings.primaryEmail" type="email" />
          </label>
          <label>
            <span>Correo secundario</span>
            <input v-model="landingForm.settings.secondaryEmail" type="email" />
          </label>
          <label>
            <span>Teléfono principal</span>
            <input v-model="landingForm.settings.primaryPhone" type="text" />
          </label>
          <label>
            <span>Teléfono secundario</span>
            <input v-model="landingForm.settings.secondaryPhone" type="text" />
          </label>
          <label>
            <span>WhatsApp</span>
            <input v-model="landingForm.settings.whatsappNumber" type="text" />
          </label>
          <label>
            <span>Dirección</span>
            <input v-model="landingForm.settings.address" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>Texto de footer</span>
            <textarea v-model="landingForm.settings.footerText" rows="3"></textarea>
          </label>
        </div>
      </section>

      <section class="admin-form-card">
        <div class="admin-results-header">
          <div>
            <span>Hero</span>
            <h3>Cabecera principal</h3>
          </div>
        </div>

        <div class="admin-form-grid">
          <label>
            <span>Eyebrow</span>
            <input v-model="landingForm.hero.eyebrow" type="text" />
          </label>
          <label>
            <span>Publicado</span>
            <select v-model="landingForm.hero.isPublished">
              <option :value="true">Sí</option>
              <option :value="false">No</option>
            </select>
          </label>
          <label class="admin-field-wide">
            <span>Título</span>
            <textarea v-model="landingForm.hero.title" rows="3"></textarea>
          </label>
          <label class="admin-field-wide">
            <span>Subtítulo</span>
            <textarea v-model="landingForm.hero.subtitle" rows="4"></textarea>
          </label>
          <label>
            <span>CTA principal</span>
            <input v-model="landingForm.hero.primaryCtaLabel" type="text" />
          </label>
          <label>
            <span>URL CTA principal</span>
            <input v-model="landingForm.hero.primaryCtaUrl" type="text" />
          </label>
          <label>
            <span>CTA secundaria</span>
            <input v-model="landingForm.hero.secondaryCtaLabel" type="text" />
          </label>
          <label>
            <span>URL CTA secundaria</span>
            <input v-model="landingForm.hero.secondaryCtaUrl" type="text" />
          </label>
          <label>
            <span>Chip superior</span>
            <input v-model="landingForm.hero.chipTop" type="text" />
          </label>
          <label>
            <span>Chip inferior</span>
            <input v-model="landingForm.hero.chipBottom" type="text" />
          </label>
          <label class="admin-field-wide">
            <span>URL imagen de fondo</span>
            <input v-model="landingForm.hero.backgroundImageUrl" type="url" placeholder="https://..." />
          </label>
        </div>

        <div class="admin-upload-row">
          <label class="button button-outline admin-upload-button">
            {{ isUploadingHero ? 'Subiendo...' : 'Subir imagen del hero' }}
            <input type="file" accept="image/*" :disabled="isUploadingHero" @change="handleHeroImageSelected" />
          </label>
          <small>{{ landingForm.hero.backgroundImageUrl || 'Aún no hay imagen subida.' }}</small>
        </div>
      </section>

      <section class="admin-form-card">
        <div class="admin-results-header">
          <div>
            <span>Servicios</span>
            <h3>Bloques comerciales</h3>
          </div>
          <button class="button button-outline" type="button" @click="addService">Agregar servicio</button>
        </div>

        <div class="admin-repeat-list">
          <article v-for="(item, index) in landingForm.services" :key="`service-${index}`" class="admin-repeat-card">
            <div class="admin-repeat-header">
              <strong>Servicio {{ index + 1 }}</strong>
              <button class="button button-outline" type="button" @click="removeService(index)">Quitar</button>
            </div>
            <div class="admin-form-grid compact-grid">
              <label>
                <span>Título</span>
                <input v-model="item.title" type="text" />
              </label>
              <label>
                <span>Icono</span>
                <input v-model="item.icon" type="text" maxlength="3" />
              </label>
              <label>
                <span>Orden</span>
                <input v-model="item.displayOrder" type="number" min="0" />
              </label>
              <label>
                <span>Activo</span>
                <select v-model="item.isActive">
                  <option :value="true">Sí</option>
                  <option :value="false">No</option>
                </select>
              </label>
              <label class="admin-field-wide">
                <span>Descripción</span>
                <textarea v-model="item.description" rows="3"></textarea>
              </label>
            </div>
          </article>
        </div>
      </section>

      <section class="admin-form-card">
        <div class="admin-results-header">
          <div>
            <span>Testimonios</span>
            <h3>Prueba social</h3>
          </div>
          <button class="button button-outline" type="button" @click="addTestimonial">Agregar testimonio</button>
        </div>

        <div class="admin-repeat-list">
          <article
            v-for="(item, index) in landingForm.testimonials"
            :key="`testimonial-${index}`"
            class="admin-repeat-card"
          >
            <div class="admin-repeat-header">
              <strong>Testimonio {{ index + 1 }}</strong>
              <button class="button button-outline" type="button" @click="removeTestimonial(index)">Quitar</button>
            </div>
            <div class="admin-form-grid compact-grid">
              <label>
                <span>Empresa</span>
                <input v-model="item.companyName" type="text" />
              </label>
              <label>
                <span>Autor</span>
                <input v-model="item.authorName" type="text" />
              </label>
              <label>
                <span>Rating</span>
                <input v-model="item.rating" type="number" min="1" max="5" />
              </label>
              <label>
                <span>Orden</span>
                <input v-model="item.displayOrder" type="number" min="0" />
              </label>
              <label>
                <span>Activo</span>
                <select v-model="item.isActive">
                  <option :value="true">Sí</option>
                  <option :value="false">No</option>
                </select>
              </label>
              <label class="admin-field-wide">
                <span>Cita</span>
                <textarea v-model="item.quote" rows="4"></textarea>
              </label>
            </div>
          </article>
        </div>
      </section>

      <section class="admin-form-card">
        <div class="admin-results-header">
          <div>
            <span>Métricas</span>
            <h3>Indicadores del hero</h3>
          </div>
          <button class="button button-outline" type="button" @click="addMetric">Agregar métrica</button>
        </div>

        <div class="admin-repeat-list">
          <article v-for="(item, index) in landingForm.metrics" :key="`metric-${index}`" class="admin-repeat-card">
            <div class="admin-repeat-header">
              <strong>Métrica {{ index + 1 }}</strong>
              <button class="button button-outline" type="button" @click="removeMetric(index)">Quitar</button>
            </div>
            <div class="admin-form-grid compact-grid">
              <label>
                <span>Valor</span>
                <input v-model="item.value" type="text" />
              </label>
              <label>
                <span>Etiqueta</span>
                <input v-model="item.label" type="text" />
              </label>
              <label>
                <span>Orden</span>
                <input v-model="item.displayOrder" type="number" min="0" />
              </label>
              <label>
                <span>Activo</span>
                <select v-model="item.isActive">
                  <option :value="true">Sí</option>
                  <option :value="false">No</option>
                </select>
              </label>
            </div>
          </article>
        </div>
      </section>

      <section class="admin-form-card">
        <div class="admin-results-header">
          <div>
            <span>Bloques de plataforma</span>
            <h3>Módulos comerciales</h3>
          </div>
          <button class="button button-outline" type="button" @click="addFeatureBlock">Agregar bloque</button>
        </div>

        <div class="admin-repeat-list">
          <article
            v-for="(item, index) in landingForm.featureBlocks"
            :key="`feature-${index}`"
            class="admin-repeat-card"
          >
            <div class="admin-repeat-header">
              <strong>Bloque {{ index + 1 }}</strong>
              <button class="button button-outline" type="button" @click="removeFeatureBlock(index)">Quitar</button>
            </div>
            <div class="admin-form-grid compact-grid">
              <label>
                <span>Eyebrow</span>
                <input v-model="item.eyebrow" type="text" />
              </label>
              <label>
                <span>Título</span>
                <input v-model="item.title" type="text" />
              </label>
              <label>
                <span>Orden</span>
                <input v-model="item.displayOrder" type="number" min="0" />
              </label>
              <label>
                <span>Activo</span>
                <select v-model="item.isActive">
                  <option :value="true">Sí</option>
                  <option :value="false">No</option>
                </select>
              </label>
              <label class="admin-field-wide">
                <span>Texto</span>
                <textarea v-model="item.text" rows="4"></textarea>
              </label>
              <label class="admin-field-wide">
                <span>Bullets (una línea por bullet)</span>
                <textarea v-model="item.bulletsText" rows="5"></textarea>
              </label>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
