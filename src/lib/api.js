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
  const response = await fetch(path, {
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
