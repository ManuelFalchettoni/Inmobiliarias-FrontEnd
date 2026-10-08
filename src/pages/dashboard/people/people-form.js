/**
 * Valores por defecto y validación del alta / edición de personas. Replica las
 * anotaciones del `PeopleRequest` para que el error aparezca antes del 400.
 */
import { isValidCuit, normalizePhone, onlyDigits } from '../../../services/agencies.js'
import { PEOPLE_LIMITS } from '../../../services/people.js'

export const peopleDefaultValues = {
  agencyId: null,
  name: '',
  email: '',
  phone: '',
  address: '',
  dni: '',
  cuit: '',
}

// Mismo patrón de email que en usuarios (ver user-form.js).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

// Una regla por campo; los opcionales (dirección, DNI, CUIT) devuelven null si
// están vacíos y solo se validan si se escribe algo.
export const peopleValidation = {
  agencyId: (value) => (value ? null : 'Elija la inmobiliaria.'),

  name: (value) => {
    const { min, max } = PEOPLE_LIMITS.name
    const text = clean(value)
    if (!text) return 'Indique el nombre.'
    if (text.length < min) return `El nombre debe tener al menos ${min} caracteres.`
    if (text.length > max) return `El nombre no puede superar los ${max} caracteres.`
    return null
  },

  email: (value) => {
    const text = clean(value)
    if (!text) return 'Indique el email.'
    if (!EMAIL_PATTERN.test(text)) return 'El email no tiene un formato válido.'
    if (text.length > PEOPLE_LIMITS.email.max) {
      return `El email no puede superar los ${PEOPLE_LIMITS.email.max} caracteres.`
    }
    return null
  },

  phone: (value) => {
    const raw = clean(value)
    if (!raw) return 'Indique un teléfono.'
    if (!/^\+?[\d\s()-]+$/.test(raw)) return 'Use solo números, espacios, guiones y un + inicial.'
    const { min, max } = PEOPLE_LIMITS.phone
    const normalized = normalizePhone(raw)
    if (normalized.length < min) return `El teléfono debe tener al menos ${min} dígitos.`
    if (normalized.length > max) return `El teléfono no puede superar los ${max} caracteres.`
    return null
  },

  address: (value) => {
    const text = clean(value)
    if (!text) return null
    const { min, max } = PEOPLE_LIMITS.address
    if (text.length < min) return `La dirección debe tener al menos ${min} caracteres.`
    if (text.length > max) return `La dirección no puede superar los ${max} caracteres.`
    return null
  },

  dni: (value) => {
    const text = clean(value)
    if (!text) return null
    // Se aceptan los puntos de "30.123.456"; al backend viajan solo los dígitos.
    if (!/^[\d.]+$/.test(text)) return 'Use solo números.'
    const digits = onlyDigits(text)
    const { min, max } = PEOPLE_LIMITS.dni
    if (digits.length < min || digits.length > max) return `El DNI debe tener entre ${min} y ${max} dígitos.`
    return null
  },

  cuit: (value) => {
    const digits = onlyDigits(value)
    if (!digits) return null
    if (digits.length !== PEOPLE_LIMITS.cuit.min) return 'El CUIT debe tener 11 dígitos.'
    if (!isValidCuit(value)) return 'El dígito verificador no coincide. Revise el número.'
    return null
  },
}
