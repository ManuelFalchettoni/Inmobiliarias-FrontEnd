/**
 * API de propiedades y normalización de datos.
 *
 * Los enums y los límites replican PropertyRequest / PropertyResponse y los
 * enums de enums/property del backend. Cambiar algo acá exige el cambio
 * equivalente en Java.
 */
import { get, patch, post, put, del } from './api.js'

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
 * marcas de tiempo viven en `PropertyResponse`. Spring ignora los campos que
 * no conoce, así que mandarlos no falla — simplemente no llegan a ningún lado.
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
 * GET /api/properties -> `Page<PropertyResponse>` de Spring:
 * `{ content, totalElements, totalPages, number, size, first, last }`.
 *
 * Todo lo que no sea paginación se trata como filtro, así sumar filtros nuevos
 * en el backend no obliga a tocar este archivo.
 */
export function listProperties({ page = 0, size = 20, sort = 'createdAt,desc', ...filters } = {}, options) {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort })

  // Los filtros sin valor no viajan: el backend distingue "sin filtrar" de
  // "filtrado por vacío". Ojo, `!value` acá descartaría active=false.
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(key, String(value))
  }

  return get(`${PROPERTIES_ENDPOINT}?${params}`, options)
}

export const findProperty = (id, options) => get(`${PROPERTIES_ENDPOINT}/${id}`, options)
export const createProperty = (request, options) => post(PROPERTIES_ENDPOINT, request, options)
export const updateProperty = (id, request, options) =>
  put(`${PROPERTIES_ENDPOINT}/${id}`, request, options)

/** Baja lógica: responde 204 y la propiedad queda con `active = false`. */
export const deleteProperty = (id, options) => del(`${PROPERTIES_ENDPOINT}/${id}`, options)

/** Revierte la baja lógica. Se llega a estas propiedades listando con `active: false`. */
export const restoreProperty = (id, options) =>
  patch(`${PROPERTIES_ENDPOINT}/${id}/restore`, undefined, options)
