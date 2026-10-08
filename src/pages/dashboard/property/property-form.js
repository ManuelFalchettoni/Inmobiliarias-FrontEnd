/**
 * Valores por defecto y validación del alta / edición de propiedad.
 *
 * Replica las anotaciones del `PropertyRequest`. `floorNumber` es opcional en
 * el DTO, pero acá se pide siempre: arranca en 0 (planta baja) y así el dato
 * no queda vacío en el listado.
 */
import { PROPERTY_LIMITS, toDecimal, toInt } from '../../../services/properties.js'

export const propertyDefaultValues = {
  address: '',
  province: '',
  county: '',
  city: '',
  latitude: '',
  longitude: '',
  type: null,
  condition: null,
  occupancy: null,
  agencyId: null,
  year: '',
  size: '',
  rooms: '',
  // 0 = planta baja; es el caso de casi todo lo que no es un departamento.
  floorNumber: 0,
}

/** Tope de un `Integer` de Java: más arriba Jackson responde 400 por overflow. */
const JAVA_INT_MAX = 2147483647

function text(value, { max }, subject, { required = true } = {}) {
  const trimmed = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return required ? `Indique ${subject}.` : null
  if (trimmed.length > max) return `No puede superar los ${max} caracteres.`
  return null
}

function integer(value, { min = 0, max = JAVA_INT_MAX } = {}, { required = true } = {}) {
  if (value === '' || value == null) return required ? 'Campo obligatorio.' : null
  const parsed = toInt(value)
  if (parsed == null || parsed !== Number(value)) return 'Debe ser un número entero.'
  if (parsed < min) return `El mínimo es ${min}.`
  if (parsed > max) return `El máximo es ${max}.`
  return null
}

/** Latitud y longitud van juntas: una sola no sirve para ubicar el punto. */
function coordinate(value, { min, max }, other, subject) {
  const empty = value === '' || value == null
  const otherEmpty = other === '' || other == null
  if (empty) return otherEmpty ? null : `Indique también la ${subject}.`
  const parsed = toDecimal(value)
  if (parsed == null) return 'Debe ser un número.'
  if (parsed < min || parsed > max) return `Debe estar entre ${min} y ${max}.`
  return null
}

const required = (message) => (value) => (value ? null : message)

export const propertyValidation = {
  address: (value) => text(value, PROPERTY_LIMITS.address, 'la dirección'),
  province: (value) => text(value, PROPERTY_LIMITS.province, 'la provincia'),
  county: (value) => text(value, PROPERTY_LIMITS.county, 'el partido', { required: false }),
  city: (value) => text(value, PROPERTY_LIMITS.city, 'la ciudad'),
  latitude: (value, values) =>
    coordinate(value, PROPERTY_LIMITS.latitude, values.longitude, 'latitud'),
  longitude: (value, values) =>
    coordinate(value, PROPERTY_LIMITS.longitude, values.latitude, 'longitud'),
  type: required('Elija el tipo de propiedad.'),
  condition: required('Elija la condición.'),
  occupancy: required('Elija la ocupación.'),
  agencyId: required('Elija la agencia que publica.'),
  year: (value) => integer(value, PROPERTY_LIMITS.year, { required: false }),
  size: (value) => integer(value, PROPERTY_LIMITS.size),
  rooms: (value) => integer(value, PROPERTY_LIMITS.rooms),
  floorNumber: (value) => integer(value, PROPERTY_LIMITS.floorNumber),
}
