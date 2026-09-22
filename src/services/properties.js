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
 * y los otros dos en 0 (`@PositiveOrZero`): ese dígito de diferencia es el que
 * decide entre un alta válida y un 400.
 */
export const PROPERTY_LIMITS = {
  address: { max: 150 },
  location: { max: 100 },
  year: { min: 1800, max: 2100 },
  size: { min: 1 },
  rooms: { min: 0 },
  floorNumber: { min: 0 },
}

/**
 * Convierte el valor de un NumberInput a entero.
 *
 * Mantine devuelve '' cuando el campo se vacía. Mandar eso al backend es el
 * origen de los ceros fantasma: Jackson convierte '' y null a 0 en los int
 * primitivos sin protestar.
 */
export function toInt(value, fallback = null) {
  if (value === '' || value == null) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

/**
 * Traduce los valores del formulario al `PropertyRequest`.
 *
 * Solo salen de acá los 10 campos del DTO: `id`, `active`, `photos` y las
 * marcas de tiempo viven en `PropertyResponse`. El backend corre con
 * `fail-on-unknown-properties=true`, así que cualquier campo de más convierte
 * el alta en un 400 "Malformed or invalid request body".
 */
export function toPropertyRequest(values) {
  return {
    // Se colapsan los espacios repetidos antes de medir contra el max del @Size.
    address: values.address.trim().replace(/\s+/g, ' '),
    location: values.location.trim().replace(/\s+/g, ' '),
    type: values.type,
    condition: values.condition,
    occupancy: values.occupancy,
    // El Select de Mantine entrega strings; el backend espera un Long.
    idAgency: toInt(values.idAgency),
    // `year` es Integer en Java: null es un valor aceptado y saltea @Min/@Max.
    year: toInt(values.year),
    // Los tres son int primitivos: nunca pueden viajar como null. El 0 acá es
    // solo para mantener el payload válido; los vacíos los frena la validación
    // del formulario antes de llegar a este punto.
    size: toInt(values.size, 0),
    rooms: toInt(values.rooms, 0),
    floorNumber: toInt(values.floorNumber, 0),
  }
}

/**
 * Inversa de `toPropertyRequest`: carga un `PropertyResponse` en el formulario
 * de edición. Los números quedan como números (lo que espera NumberInput) e
 * `idAgency` como string (lo que espera Select). `year` puede no venir: el
 * backend omite los null (`default-property-inclusion=non_null`).
 */
export function toPropertyFormValues(property) {
  return {
    address: property.address ?? '',
    location: property.location ?? '',
    type: property.type ?? null,
    condition: property.condition ?? null,
    occupancy: property.occupancy ?? null,
    idAgency: property.idAgency != null ? String(property.idAgency) : null,
    year: property.year ?? '',
    size: property.size ?? '',
    rooms: property.rooms ?? '',
    floorNumber: property.floorNumber ?? 0,
  }
}

/**
 * GET /api/properties -> `Page<PropertyResponse>` de Spring:
 * `{ content, totalElements, totalPages, number, size, first, last }`.
 * Filtros: `idAgency` y `active`.
 */
export const listProperties = (params, options) =>
  get(`${PROPERTIES_ENDPOINT}?${pageQuery(params)}`, options)

export const findProperty = (id, options) => get(`${PROPERTIES_ENDPOINT}/${id}`, options)
export const createProperty = (request, options) => post(PROPERTIES_ENDPOINT, request, options)

/** El backend responde 400 si `idAgency` difiere de la actual: no se mueve de agencia. */
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
  maxFileSize: 5 * 1024 * 1024, // spring.servlet.multipart.max-file-size
  extensions: ['jpg', 'jpeg', 'png', 'webp'],
}

/** Formato `accept` de react-dropzone (lo usa el Dropzone de Mantine). */
export const PHOTO_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

function extensionOf(name) {
  const text = String(name ?? '')
  const dot = text.lastIndexOf('.')
  return dot < 0 ? '' : text.slice(dot + 1).toLowerCase()
}

export const formatFileSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** Mismas reglas que `MinioPhotoStorage.store`, para no gastar un viaje en un 400 seguro. */
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
  const body = new FormData()
  for (const file of files) body.append('files', file, file.name)
  return post(photosEndpoint(propertyId), body, { timeout: 60000, ...options })
}

/** Borra la fila y el archivo en MinIO: no tiene restore. */
export const deletePropertyPhoto = (propertyId, photoId, options) =>
  del(`${photosEndpoint(propertyId)}/${photoId}`, options)
