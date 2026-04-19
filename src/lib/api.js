const apiBaseUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')

export function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path
  }

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function readResponsePayload(response) {
  const rawText = await response.text()

  if (!rawText) {
    return null
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return {
      message:
        'La API respondió en un formato inesperado. Verifica que `npm run dev:server` esté activo.',
    }
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    ...options,
  })

  const result = await readResponsePayload(response)

  if (!response.ok) {
    const message = result?.message || 'La solicitud no pudo completarse. Intenta nuevamente.'
    throw new Error(message)
  }

  return result
}
