/**
 * Cliente HTTP del backend (Spring Boot: ManuelFalchettoni/Inmobiliarias-BackEnd).
 *
 * La API es abierta en desarrollo (SecurityConfig: `anyRequest().permitAll()`) y
 * no usa cookies ni sesión, por eso no se envían credenciales. El CORS del backend
 * habilita http://localhost:5173 y http://localhost:3000.
 *
 * Es el único archivo que hace `fetch`. Las pantallas llaman a un servicio
 * (`properties.js`, `crm.js`...) y el servicio llama a las funciones de acá.
 * Así la dirección del backend, el tiempo máximo y la lectura de errores
 * viven en un solo lugar.
 */

// `import.meta.env` son las variables de entorno del archivo `.env`. Vite solo
// expone las que empiezan con `VITE_`. `??` usa el valor de la derecha si la
// variable no existe. El `replace` borra las barras del final para no armar
// direcciones con `//` (por ejemplo `http://localhost:8080//api/...`).
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
const DEFAULT_TIMEOUT = 15000 // 15 segundos

/**
 * Error de API con el detalle del `ApiErrorResponse` del backend:
 * `{ timestamp, status, error, message, path }`.
 *
 * `extends Error` lo hace un error "de verdad" (tiene `message`, se puede
 * lanzar con `throw` y atrapar con `catch`), con datos extra para la pantalla.
 * `status = 0` significa "no hubo respuesta": ningún código HTTP real es 0.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, path = '', fieldErrors = {}, detail = message, cause } = {}) {
    // `super` llama al constructor de Error. `cause` guarda el error original
    // (por ejemplo, el TypeError de fetch) para poder rastrearlo al depurar.
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.path = path
    this.fieldErrors = fieldErrors
    /** Mensaje tal cual lo mandó el backend, para depurar. */
    this.detail = detail
  }

  // Los `get` son propiedades calculadas: se leen como `error.isConflict`, sin
  // paréntesis, y se recalculan cada vez a partir de `status` y `fieldErrors`.

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
  // La regex corta en cada coma seguida de `nombreDeCampo:`. El `(?=...)` es un
  // "lookahead": mira lo que viene después sin consumirlo, así el nombre del
  // campo queda en el pedazo siguiente.
  // Ejemplo: "email: must be valid, name: size must be between 3 and 20"
  //       -> ["email: must be valid", "name: size must be between 3 and 20"]
  for (const part of message.split(/,\s*(?=[a-zA-Z][a-zA-Z0-9]*:\s)/)) {
    // Separa "campo: mensaje" en dos grupos: match[1] = campo, match[2] = mensaje.
    // La bandera `s` deja que `.` también acepte saltos de línea.
    const match = /^([a-zA-Z][a-zA-Z0-9]*):\s*(.+)$/s.exec(part.trim())
    if (!match) return {}
    fieldErrors[match[1]] = match[2].trim()
  }
  // Resultado: { email: 'must be valid', name: 'size must be...' }, que el
  // formulario pone debajo de cada input con `form.setErrors`.
  return fieldErrors
}

/**
 * Lee el cuerpo de la respuesta según lo que haya. Nunca lanza: una respuesta
 * mal formada se trata como "sin cuerpo" (`null`).
 */
async function readBody(response) {
  // 204 "No Content": salió bien pero no hay nada que leer (borrar, dar de baja,
  // cambiar la contraseña). Intentar leer JSON acá fallaría.
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
  // Sin cuerpo (un GET o un restore): no se manda nada ni `Content-Type`.
  if (body === undefined) return { body: undefined, headers }
  // Archivos: el FormData tal cual (ver el comentario de arriba).
  if (body instanceof FormData) return { body, headers }
  // Datos: el objeto convertido a texto JSON, avisando que es JSON.
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
  // Dos formas de cortar el pedido: que se cumpla el tiempo máximo
  // (`AbortSignal.timeout`) o que el componente lo cancele (`signal`, de un
  // AbortController). `AbortSignal.any` las combina: corta lo que pase primero.
  const signals = [AbortSignal.timeout(timeout)]
  if (signal) signals.push(signal)

  let response
  try {
    // `await` espera la respuesta sin bloquear la página. Si no hay respuesta
    // (servidor caído, CORS, corte), `fetch` lanza un error y se va al `catch`.
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
        : // El navegador no distingue "servidor caído" de "CORS rechazado": los dos llegan
          // como el mismo TypeError. Por eso el mensaje nombra ambas causas y el origen.
          `No se pudo conectar con el servidor (${BASE_URL}). Verifique que el backend esté levantado ` +
          `y que su CORS permita este origen (${window.location.origin}).`,
      { path, cause },
    )
  }

  const payload = await readBody(response)

  // `response.ok` es true para los códigos 200 a 299. Un 400, 404 o 409 NO hace
  // fallar a `fetch`: hay que revisarlo a mano y convertirlo en un ApiError.
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

// Atajos por método HTTP. El `...options` copia las opciones que se reciban
// (por ejemplo `signal` o `timeout`) y después se fija el método.
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
  // `...filters` junta todo lo que no sea page, size ni sort: { active, agencyId... }.
  // URLSearchParams arma el texto y codifica los caracteres especiales
  // (la coma de "createdAt,desc" viaja como %2C).
  const params = new URLSearchParams({ page: String(page), size: String(size), sort })

  // Object.entries convierte { active: true } en [['active', true]].
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(key, String(value))
  }

  return params.toString()
}
