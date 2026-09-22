/**
 * Valores por defecto y validación del alta de usuario.
 *
 * Lo usan el registro público (`/registro`, rol fijo USER) y el alta desde el
 * panel (`/dashboard/usuarios/nuevo`, con rol a elección). Las reglas replican
 * el `UserRequest` del backend para que el error aparezca antes del 400.
 */
import { ApiError } from '../../services/api.js'
import { normalizePhone } from '../../services/agencies.js'
import { PUBLIC_SIGNUP_ROL, USER_LIMITS, userConflictField } from '../../services/users.js'

const CONFLICT_MESSAGES = {
  email: 'Ya existe una cuenta con este email.',
  phoneNumber: 'Este teléfono ya está registrado en otra cuenta.',
}

/**
 * Traduce el error del alta a `{ message, fieldErrors }`: los 400 de validación
 * traen el campo en el mensaje y los 409 se reconocen por su prefijo.
 */
export function describeUserError(error) {
  if (!(error instanceof ApiError)) {
    return { message: 'Ocurrió un error inesperado al crear la cuenta.', fieldErrors: {} }
  }
  if (error.isConflict) {
    const field = userConflictField(error.message)
    return field
      ? { message: CONFLICT_MESSAGES[field], fieldErrors: { [field]: CONFLICT_MESSAGES[field] } }
      : { message: 'Alguno de los datos ya está registrado.', fieldErrors: {} }
  }
  return { message: error.message, fieldErrors: error.fieldErrors }
}

export const userDefaultValues = {
  name: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  rol: PUBLIC_SIGNUP_ROL,
  acceptTerms: false,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const userValidation = {
  name: (value) => {
    const trimmed = String(value ?? '').trim()
    const { min, max } = USER_LIMITS.name
    if (!trimmed) return 'Indique el nombre.'
    if (trimmed.length < min) return `El nombre debe tener al menos ${min} caracteres.`
    if (trimmed.length > max) return `El nombre no puede superar los ${max} caracteres.`
    return null
  },

  email: (value) => {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return 'Indique el email.'
    if (!EMAIL_PATTERN.test(trimmed)) return 'El email no tiene un formato válido.'
    if (trimmed.length > USER_LIMITS.email.max) {
      return `El email no puede superar los ${USER_LIMITS.email.max} caracteres.`
    }
    return null
  },

  phoneNumber: (value) => {
    const raw = String(value ?? '').trim()
    if (!raw) return 'Indique un teléfono de contacto.'
    if (!/^\+?[\d\s()-]+$/.test(raw)) return 'Use solo números, espacios, guiones y un + inicial.'

    const { min, max } = USER_LIMITS.phoneNumber
    const normalized = normalizePhone(raw)
    if (normalized.length < min) return `El teléfono debe tener al menos ${min} dígitos.`
    if (normalized.length > max) return `El teléfono no puede superar los ${max} caracteres (con el + del país).`
    return null
  },

  password: (value) => {
    const { min, max } = USER_LIMITS.password
    if (!value) return 'Indique una contraseña.'
    if (value.length < min) return `La contraseña debe tener al menos ${min} caracteres.`
    if (value.length > max) return `La contraseña no puede superar los ${max} caracteres.`
    return null
  },

  confirmPassword: (value, values) => {
    if (!value) return 'Repita la contraseña.'
    return value === values.password ? null : 'Las contraseñas no coinciden.'
  },

  rol: (value) => (value ? null : 'Elija un rol.'),

  acceptTerms: (value) => (value ? null : 'Debe aceptar los términos y condiciones.'),
}
