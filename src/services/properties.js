/**
 * API de propiedades y normalización de datos.
 *
 * Los enums y los límites replican PropertyRequest / PropertyResponse y los
 * enums de enums/property del backend. Cambiar algo acá exige el cambio
 * equivalente en Java.
 */
import { get, pageQuery, patch, post, put, del } from './api.js'

export const PROPERTIES_ENDPOINT = '/api/properties'

/**
 * Cada enum se expone en dos formas porque se consumen distinto:
 * `_OPTIONS` es lo que come el `data` de un Select de Mantine, y `_LABEL`
 * traduce en O(1) al pintar una fila de la tabla. El mapa se deriva del array
 * para que no puedan desincronizarse.
 */
const toLabelMap = (options) => Object.fromEntries(options.map((o) => [o.value, o.label]))

export const PROPERTY_TYPE_OPTIONS = [
  { value: 'HOUSE', label: 'Casa' },
  { value: 'APARTMENT', label: 'Departamento' },
  { value: 'PH', label: 'PH' },
  { value: 'LAND', label: 'Terreno' },
  { value: 'OFFICE', label: 'Oficina' },
  { value: 'COMMERCIAL_SPACE', label: 'Local comercial' },
  { value: 'WAREHOUSE', label: 'Depósito' },
  { value: 'GARAGE', label: 'Cochera' },
  { value: 'FARM', label: 'Campo' },
]

export const PROPERTY_CONDITION_OPTIONS = [
  { value: 'BRAND_NEW', label: 'A estrenar' },
  { value: 'GOOD', label: 'Buen estado' },
  { value: 'NEEDS_REPAIR', label: 'A refaccionar' },
  { value: 'UNDER_CONSTRUCTION', label: 'En construcción' },
]

export const PROPERTY_OCCUPANCY_OPTIONS = [
  { value: 'VACANT', label: 'Libre' },
  { value: 'OWNER_OCCUPIED', label: 'Ocupada por el dueño' },
  { value: 'TENANT_OCCUPIED', label: 'Con inquilino' },
]

export const PROPERTY_TYPE_LABEL = toLabelMap(PROPERTY_TYPE_OPTIONS)
export const PROPERTY_CONDITION_LABEL = toLabelMap(PROPERTY_CONDITION_OPTIONS)
export const PROPERTY_OCCUPANCY_LABEL = toLabelMap(PROPERTY_OCCUPANCY_OPTIONS)

/** Color del Badge de condición en el listado. */
export const PROPERTY_CONDITION_COLOR = {
  BRAND_NEW: 'teal',
  GOOD: 'blue',
  NEEDS_REPAIR: 'orange',
  UNDER_CONSTRUCTION: 'gray',
}

/**
 * Límites tomados de las anotaciones del DTO. `size` arranca en 1 (`@Positive`)
 * y `rooms` y `floorNumber` en 0 (`@PositiveOrZero`): ese dígito de diferencia
 * es el que decide entre un alta válida y un 400.
 */
export const PROPERTY_LIMITS = {
  address: { max: 150 },
  province: { max: 50 },
  county: { max: 100 },
  city: { max: 100 },
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
  year: { min: 1800, max: 2100 },
  size: { min: 1 },
  rooms: { min: 0 },
  floorNumber: { min: 0 },
}

/**
 * Convierte el valor de un NumberInput a entero.
 *
 * Mantine devuelve '' cuando el campo se vacía; al backend tiene que llegar
 * null, que es lo que sus `@NotNull` reconocen como dato faltante.
 */
export function toInt(value, fallback = null) {
  // `== null` (con dos iguales) es verdadero para null Y para undefined.
  if (value === '' || value == null) return fallback
  const parsed = Number(value)
  // isFinite descarta NaN e Infinity; Math.trunc corta los decimales (3.7 -> 3).
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

/** Convierte el valor de un NumberInput a número con decimales (coordenadas). */
export function toDecimal(value) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

/**
 * Traduce los valores del formulario al `PropertyRequest`.
 *
 * Solo salen de acá los campos del DTO: `id`, `active`, `photos`, `prices` y
 * las marcas de tiempo viven en `PropertyResponse`. El backend corre con
 * `fail-on-unknown-properties=true`, así que cualquier campo de más convierte
 * el alta en un 400 "Malformed or invalid request body".
 */
export function toPropertyRequest(values) {
  return {
    // Se colapsan los espacios repetidos antes de medir contra el max del @Size.
    address: cleanText(values.address),
    province: cleanText(values.province),
    // Opcionales: sin valor viajan como null en lugar de "".
    county: cleanText(values.county) || null,
    city: cleanText(values.city),
    latitude: toDecimal(values.latitude),
    longitude: toDecimal(values.longitude),
    type: values.type,
    condition: values.condition,
    occupancy: values.occupancy,
    // El Select de Mantine entrega strings; el backend espera un Long.
    agencyId: toInt(values.agencyId),
    year: toInt(values.year),
    // Los vacíos los frena la validación del formulario antes de llegar acá.
    size: toInt(values.size),
    rooms: toInt(values.rooms),
    floorNumber: toInt(values.floorNumber),
  }
}

/**
 * Inversa de `toPropertyRequest`: carga un `PropertyResponse` en el formulario
 * de edición. Los números quedan como números (lo que espera NumberInput) y
 * `agencyId` como string (lo que espera Select). Los opcionales pueden no
 * venir: el backend omite los null (`default-property-inclusion=non_null`).
 */
export function toPropertyFormValues(property) {
  return {
    address: property.address ?? '',
    province: property.province ?? '',
    county: property.county ?? '',
    city: property.city ?? '',
    latitude: property.latitude ?? '',
    longitude: property.longitude ?? '',
    type: property.type ?? null,
    condition: property.condition ?? null,
    occupancy: property.occupancy ?? null,
    agencyId: property.agencyId != null ? String(property.agencyId) : null,
    year: property.year ?? '',
    size: property.size ?? '',
    rooms: property.rooms ?? '',
    floorNumber: property.floorNumber ?? 0,
    prices: toPriceFormValues(property.prices),
  }
}

/**
 * Ciudad, partido y provincia en una línea. El partido se omite si repite la
 * ciudad, que es lo habitual en las capitales ("Rosario, Rosario").
 */
export function formatPropertyPlace(property) {
  // Desestructuración: saca esos tres campos del objeto en variables sueltas.
  const { city, county, province } = property ?? {}
  const parts = [city, county !== city ? county : null, province]
  // `filter(Boolean)` saca los vacíos (null, undefined, '') antes de unir con comas.
  return parts.filter(Boolean).join(', ')
}

/**
 * GET /api/properties -> `Page<PropertyResponse>` de Spring:
 * `{ content, totalElements, totalPages, number, size, first, last }`.
 * Filtros: `agencyId` y `active`.
 */
export const listProperties = (params, options) =>
  get(`${PROPERTIES_ENDPOINT}?${pageQuery(params)}`, options)

export const findProperty = (id, options) => get(`${PROPERTIES_ENDPOINT}/${id}`, options)
export const createProperty = (request, options) => post(PROPERTIES_ENDPOINT, request, options)

/** El backend responde 400 si `agencyId` difiere de la actual: no se mueve de agencia. */
export const updateProperty = (id, request, options) =>
  put(`${PROPERTIES_ENDPOINT}/${id}`, request, options)

/** Baja lógica: responde 204 y la propiedad queda con `active = false`. */
export const deleteProperty = (id, options) => del(`${PROPERTIES_ENDPOINT}/${id}`, options)

/** Revierte la baja lógica. Se llega a estas propiedades listando con `active: false`. */
export const restoreProperty = (id, options) =>
  patch(`${PROPERTIES_ENDPOINT}/${id}/restore`, undefined, options)

// ------------------------------------------------------------------ Fotos

/**
 * Límites de `PropertyPhotoCreatorService`, `MinioPhotoStorage` y del multipart
 * de `application.properties`.
 *
 * El backend valida la extensión del nombre del archivo, no solo el
 * content-type: una imagen sin extensión se rechaza aunque sea un PNG válido.
 */
export const PHOTO_LIMITS = {
  maxPhotos: 20,
  // 1 KB = 1024 bytes y 1 MB = 1024 KB: son 5.242.880 bytes. Se escribe como
  // multiplicación para que se lea "5 MB".
  maxFileSize: 5 * 1024 * 1024, // spring.servlet.multipart.max-file-size
  extensions: ['jpg', 'jpeg', 'png', 'webp'],
}

/** Formato `accept` de react-dropzone (lo usa el Dropzone de Mantine). */
export const PHOTO_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

/** "Frente.JPG" -> "jpg". Busca el ÚLTIMO punto, así "foto.final.png" da "png". */
function extensionOf(name) {
  const text = String(name ?? '')
  const dot = text.lastIndexOf('.')
  return dot < 0 ? '' : text.slice(dot + 1).toLowerCase()
}

/** Tamaño legible: 2.300.000 bytes -> "2.2 MB"; 800 bytes -> "1 KB". */
export const formatFileSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** Mismas reglas que `MinioPhotoStorage.store`, para no gastar un viaje en un 400 seguro. */
// Devuelve el mensaje de error o null si el archivo sirve. Se controla la
// extensión (la elige quien nombra el archivo) y también el tipo que informa el
// navegador: así un .exe renombrado a .jpg no pasa.
export function validatePhotoFile(file) {
  if (!file || file.size === 0) return 'El archivo está vacío.'
  if (!PHOTO_LIMITS.extensions.includes(extensionOf(file.name))) {
    return 'Formato no admitido. Use JPG, PNG o WEBP.'
  }
  if (!String(file.type).startsWith('image/')) return 'El archivo no es una imagen.'
  if (file.size > PHOTO_LIMITS.maxFileSize) {
    return `Pesa ${formatFileSize(file.size)}; el máximo es ${formatFileSize(PHOTO_LIMITS.maxFileSize)}.`
  }
  return null
}

/**
 * El backend no ordena la lista de fotos del response: se ordena por
 * `position`, y la primera es la portada.
 */
// `[...photos]` hace una copia: `sort` modifica el array sobre el que se llama,
// y no hay que tocar el que vino del backend (puede ser estado de React).
// `a.position - b.position` negativo pone `a` primero: orden ascendente.
export const sortPhotos = (photos = []) => [...photos].sort((a, b) => a.position - b.position)

const photosEndpoint = (propertyId) => `${PROPERTIES_ENDPOINT}/${propertyId}/photos`

/** GET -> `PropertyPhotoResponse[]`: `{ id, url, photoName, position }`. */
export const listPropertyPhotos = (propertyId, options) => get(photosEndpoint(propertyId), options)

/**
 * POST multipart con la parte `files` repetida -> 201 con las fotos creadas.
 *
 * El backend procesa el lote en una sola transacción: si un archivo falla no
 * queda ninguno. Por eso el formulario sube de a uno y reintenta solo el que
 * falló. El timeout es más largo que el de JSON porque cada archivo pesa hasta 5 MB.
 */
export function uploadPropertyPhotos(propertyId, files, options) {
  // FormData es el formato de un <form> HTML con archivos (multipart). El
  // nombre 'files' tiene que coincidir con @RequestPart("files") del controller.
  const body = new FormData()
  for (const file of files) body.append('files', file, file.name)
  // 60 s en vez de 15: subir una foto de 5 MB puede tardar más que un JSON.
  return post(photosEndpoint(propertyId), body, { timeout: 60000, ...options })
}

/** Borra la fila y el archivo en MinIO: no tiene restore. */
export const deletePropertyPhoto = (propertyId, photoId, options) =>
  del(`${photosEndpoint(propertyId)}/${photoId}`, options)

// ---------------------------------------------------------------- Precios

/** Refleja `OperationType`: una propiedad tiene a lo sumo un precio por operación. */
export const OPERATION_TYPE_OPTIONS = [
  { value: 'SALE', label: 'Venta' },
  { value: 'RENT', label: 'Alquiler' },
]

export const OPERATION_TYPE_LABEL = toLabelMap(OPERATION_TYPE_OPTIONS)

/** Refleja `Currency`. */
export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
]

/** Moneda con la que arranca cada operación: las ventas se publican en dólares. */
export const DEFAULT_CURRENCY = { SALE: 'USD', RENT: 'ARS' }

/** `@Positive` y `@Digits(integer = 13, fraction = 2)` del `PropertyPriceRequest`. */
export const PRICE_LIMITS = {
  amount: { min: 0.01, max: 9999999999999.99, decimals: 2 },
}

/** "USD 95.000" o "ARS 450.000,50": los centavos solo aparecen si los hay. */
export function formatPrice({ currency, amount }) {
  // El backend manda BigDecimal; en JSON llega como número (95000.00 -> 95000).
  const value = Number(amount)
  // toLocaleString con 'es-AR' usa punto de miles y coma decimal.
  const number = value.toLocaleString('es-AR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${number}`
}

/** Venta antes que alquiler, el mismo orden que usa el `GET` del backend. */
// Ordena según la posición de cada operación en OPERATION_TYPE_OPTIONS
// (SALE es 0, RENT es 1), no alfabéticamente.
export const sortPrices = (prices = []) =>
  [...prices].sort(
    (a, b) =>
      OPERATION_TYPE_OPTIONS.findIndex((o) => o.value === a.operationType) -
      OPERATION_TYPE_OPTIONS.findIndex((o) => o.value === b.operationType),
  )

/**
 * Precios del response -> valores del formulario, uno por operación. Una
 * operación sin precio queda deshabilitada con su moneda por defecto.
 */
export function toPriceFormValues(prices = []) {
  // Resultado: { SALE: { enabled, currency, amount }, RENT: { ... } }.
  // `{ value: operationType }` desestructura y renombra: toma `value` de cada
  // opción y lo llama `operationType`.
  return Object.fromEntries(
    OPERATION_TYPE_OPTIONS.map(({ value: operationType }) => {
      const price = prices.find((entry) => entry.operationType === operationType)
      return [
        operationType,
        {
          enabled: price != null,
          currency: price?.currency ?? DEFAULT_CURRENCY[operationType],
          amount: price?.amount ?? '',
        },
      ]
    }),
  )
}

/**
 * Compara los precios guardados con el formulario y devuelve las operaciones
 * a ejecutar: `delete`, `update` o `create`. Los borrados van primero, aunque
 * hoy no chocan: cada fila del formulario es una operación distinta.
 */
export function planPriceChanges(saved = [], formPrices) {
  const changes = []

  for (const { value: operationType } of OPERATION_TYPE_OPTIONS) {
    const current = saved.find((price) => price.operationType === operationType)
    const wanted = formPrices[operationType]
    const request = {
      operationType,
      currency: wanted.currency,
      amount: Number(wanted.amount),
    }

    // Apagado en el formulario y guardado en el backend -> borrar.
    if (!wanted.enabled) {
      if (current) changes.push({ type: 'delete', price: current })
    // Prendido y sin precio guardado -> crear.
    } else if (!current) {
      changes.push({ type: 'create', request })
    // Prendido, guardado y distinto -> actualizar. Si es igual, no se hace nada.
    } else if (current.currency !== request.currency || Number(current.amount) !== request.amount) {
      changes.push({ type: 'update', price: current, request })
    }
  }

  // Un diccionario de prioridades para ordenar: borrados, después cambios, después altas.
  const order = { delete: 0, update: 1, create: 2 }
  return changes.sort((a, b) => order[a.type] - order[b.type])
}

const pricesEndpoint = (propertyId) => `${PROPERTIES_ENDPOINT}/${propertyId}/prices`

/** GET -> `PropertyPriceResponse[]` ordenado por `operationType`. */
export const listPropertyPrices = (propertyId, options) => get(pricesEndpoint(propertyId), options)

/** POST -> 201. 409 si la propiedad ya tiene precio para esa operación. */
export const createPropertyPrice = (propertyId, request, options) =>
  post(pricesEndpoint(propertyId), request, options)

export const updatePropertyPrice = (propertyId, priceId, request, options) =>
  put(`${pricesEndpoint(propertyId)}/${priceId}`, request, options)

/** Borrado físico: 204. */
export const deletePropertyPrice = (propertyId, priceId, options) =>
  del(`${pricesEndpoint(propertyId)}/${priceId}`, options)

/**
 * Aplica los cambios de `planPriceChanges` en orden y devuelve los precios que
 * quedaron guardados. Corta en el primer error: lo que ya se aplicó queda
 * reflejado en `error.savedPrices` para no perder el estado real.
 */
export async function syncPropertyPrices(propertyId, saved, formPrices, options) {
  // `prices` va reflejando lo que queda guardado después de cada pedido.
  let prices = [...saved]

  try {
    // `await` dentro del `for`: un pedido por vez, en el orden del plan.
    for (const change of planPriceChanges(saved, formPrices)) {
      if (change.type === 'delete') {
        await deletePropertyPrice(propertyId, change.price.id, options)
        prices = prices.filter((price) => price.id !== change.price.id)
      } else if (change.type === 'update') {
        const updated = await updatePropertyPrice(propertyId, change.price.id, change.request, options)
        prices = prices.map((price) => (price.id === updated.id ? updated : price))
      } else {
        prices = [...prices, await createPropertyPrice(propertyId, change.request, options)]
      }
    }
  } catch (error) {
    // Se le "cuelga" al error lo que sí se guardó y se relanza: quien llama
    // decide qué mostrar, pero sabe el estado real del backend.
    error.savedPrices = sortPrices(prices)
    throw error
  }

  return sortPrices(prices)
}
