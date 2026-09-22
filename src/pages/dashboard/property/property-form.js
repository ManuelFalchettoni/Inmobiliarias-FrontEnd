/**
 * Valores por defecto y validación del alta / edición de propiedad.
 *
 * Replica las anotaciones del `PropertyRequest`. Los tres `int` primitivos
 * (`size`, `rooms`, `floorNumber`) son obligatorios acá aunque el DTO no tenga
 * `@NotNull`: Jackson convierte un vacío en 0 y la propiedad quedaría guardada
 * con datos inventados.
 */
import { PROPERTY_LIMITS, toInt } from '../../../services/properties.js'

export const propertyDefaultValues = {
  address: '',
  location: '',
  type: null,
  condition: null,
  occupancy: null,
  idAgency: null,
  year: '',
  size: '',
  rooms: '',
  // 0 = planta baja; es el caso de casi todo lo que no es un departamento.
  floorNumber: 0,
}

/** Tope de un `int` de Java: más arriba Jackson responde 400 por overflow. */
const JAVA_INT_MAX = 2147483647

function text(value, { max }, subject) {
  const trimmed = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return `Indique ${subject}.`
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

const required = (message) => (value) => (value ? null : message)

export const propertyValidation = {
  address: (value) => text(value, PROPERTY_LIMITS.address, 'la dirección'),
  location: (value) => text(value, PROPERTY_LIMITS.location, 'la localidad'),
  type: required('Elija el tipo de propiedad.'),
  condition: required('Elija la condición.'),
  occupancy: required('Elija la ocupación.'),
  idAgency: required('Elija la agencia que publica.'),
  year: (value) => integer(value, PROPERTY_LIMITS.year, { required: false }),
  size: (value) => integer(value, PROPERTY_LIMITS.size),
  rooms: (value) => integer(value, PROPERTY_LIMITS.rooms),
  floorNumber: (value) => integer(value, PROPERTY_LIMITS.floorNumber),
}
