/**
 * Cliente HTTP del backend (Spring Boot: ManuelFalchettoni/Inmobiliarias-BackEnd).
 *
 * La API es abierta en desarrollo (SecurityConfig: `anyRequest().permitAll()`) y
 * no usa cookies ni sesión, por eso no se envían credenciales. El CORS del backend
 * habilita http://localhost:5173 y http://localhost:3000.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
const DEFAULT_TIMEOUT = 15000

/**
 * Error de API con el detalle del `ApiErrorResponse` del backend:
 * `{ timestamp, status, error, message, path }`.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, path = '', fieldErrors = {}, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.path = path
    this.fieldErrors = fieldErrors
  }

  /** No hubo respuesta del servidor (caído, CORS, timeout o red). */
  get isNetworkError() {
    return this.status === 0
  }

  /** 409: un valor único ya está registrado (CUIT, email, teléfono o dirección). */
  get isConflict() {
    return this.status === 409
  }

  /** 400 con errores por campo que se pueden volcar al formulario. */
  get hasFieldErrors() {
    return Object.keys(this.fieldErrors).length > 0
  }
}

/**
 * El GlobalExceptionHandler concatena los errores de validación en un único string
 * con la forma `"campo: mensaje, otroCampo: mensaje"`. Los mensajes pueden contener
 * comas y puntos, así que el corte se hace en el `, ` que precede a un `campo:`.
 * Si algún fragmento no encaja se descarta todo: es preferible mostrar el mensaje
 * completo antes que inventar errores sobre campos equivocados.
 */
function parseFieldErrors(message) {
  if (typeof message !== 'string' || !message.includes(':')) return {}

  const fieldErrors = {}
  for (const part of message.split(/,\s*(?=[a-zA-Z][a-zA-Z0-9]*:\s)/)) {
    const match = /^([a-zA-Z][a-zA-Z0-9]*):\s*(.+)$/s.exec(part.trim())
    if (!match) return {}
    fieldErrors[match[1]] = match[2].trim()
  }
  return fieldErrors
}

async function readBody(response) {
  if (response.status === 204 || response.headers.get('content-length') === '0') return null

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }
  return response.text().then((text) => text || null).catch(() => null)
}

/**
 * @param {string} path Ruta absoluta del backend, p. ej. `/api/agencies`.
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body] Se serializa a JSON.
 * @param {AbortSignal} [options.signal] Cancelación del llamador (se propaga tal cual).
 * @param {number} [options.timeout]
 */
export async function request(path, { method = 'GET', body, signal, timeout = DEFAULT_TIMEOUT, headers } = {}) {
  const signals = [AbortSignal.timeout(timeout)]
  if (signal) signals.push(signal)

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: AbortSignal.any(signals),
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    // Cancelación pedida por el llamador: no es un fallo de la API.
    if (signal?.aborted) throw cause

    const timedOut = cause?.name === 'TimeoutError'
    throw new ApiError(
      timedOut
        ? 'El servidor tardó demasiado en responder. Intente nuevamente.'
        : `No se pudo conectar con el servidor (${BASE_URL}). Verifique que el backend esté levantado.`,
      { path, cause },
    )
  }

  const payload = await readBody(response)

  if (!response.ok) {
    const message =
      (typeof payload === 'string' ? payload : payload?.message) ||
      response.statusText ||
      `La solicitud falló con estado ${response.status}.`

    throw new ApiError(message, {
      status: response.status,
      path: payload?.path ?? path,
      fieldErrors: parseFieldErrors(payload?.message),
    })
  }

  return payload
}

export const get = (path, options) => request(path, { ...options, method: 'GET' })
export const post = (path, body, options) => request(path, { ...options, method: 'POST', body })
export const put = (path, body, options) => request(path, { ...options, method: 'PUT', body })
export const del = (path, options) => request(path, { ...options, method: 'DELETE' })

/**
 * PATCH. El backend lo usa para las acciones que no reemplazan el recurso
 * entero: `.../{id}/restore` y `.../{id}/password`, en los tres recursos.
 *
 * Con `body` en `undefined` (el caso de restore) `request` no manda
 * `Content-Type`, que es lo correcto para un PATCH sin cuerpo.
 */
export const patch = (path, body, options) => request(path, { ...options, method: 'PATCH', body })
