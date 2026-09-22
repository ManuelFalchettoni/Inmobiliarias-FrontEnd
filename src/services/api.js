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
  constructor(message, { status = 0, path = '', fieldErrors = {}, detail = message, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.path = path
    this.fieldErrors = fieldErrors
    /** Mensaje tal cual lo mandó el backend, para depurar. */
    this.detail = detail
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
 * Arma el cuerpo y las cabeceras según el tipo de `body`.
 *
 * Un `FormData` viaja tal cual y sin `Content-Type`: el navegador lo completa
 * con el `boundary` del multipart. Si se fijara a mano, Spring no encuentra las
 * partes y el `@RequestPart("files")` falla.
 */
function encodeBody(body, headers) {
  if (body === undefined) return { body: undefined, headers }
  if (body instanceof FormData) return { body, headers }
  return { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } }
}

/**
 * @param {string} path Ruta absoluta del backend, p. ej. `/api/agencies`.
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body] Se serializa a JSON, salvo que sea un `FormData`.
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
      ...encodeBody(body, headers),
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
    const detail =
      (typeof payload === 'string' ? payload : payload?.message) ||
      response.statusText ||
      `La solicitud falló con estado ${response.status}.`

    // Un 5xx no trae nada útil para el usuario y a veces trae el texto de una
    // excepción de Java (p. ej. con MinIO caído). El original queda en `detail`.
    const serverError = response.status >= 500
    const message = serverError
      ? 'El servidor tuvo un error al procesar la solicitud. Intente nuevamente en unos minutos.'
      : detail

    throw new ApiError(message, {
      status: response.status,
      path: payload?.path ?? path,
      fieldErrors: serverError ? {} : parseFieldErrors(payload?.message),
      detail,
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

/**
 * Query string de los listados paginados (`Page<T>` de Spring, que cuenta desde 0).
 *
 * Todo lo que no sea paginación se trata como filtro, así sumar filtros nuevos
 * en el backend no obliga a tocar los servicios. Los filtros sin valor no
 * viajan; ojo, un `!value` acá descartaría `active=false`.
 */
export function pageQuery({ page = 0, size = 20, sort = 'createdAt,desc', ...filters } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort })

  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(key, String(value))
  }

  return params.toString()
}
