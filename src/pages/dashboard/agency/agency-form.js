/**
 * Valores por defecto, validación y borrador del alta de agencia.
 *
 * Las reglas replican las restricciones del `AgencyRequest` del backend para que
 * el usuario vea el error antes del viaje de red, no después del 400.
 */
import {
  AGENCY_LIMITS,
  AGENCY_STATUS,
  isValidCuit,
  isValidWebUrl,
  normalizePhone,
  normalizeWebUrl,
  onlyDigits,
} from '../../../services/agencies.js'

export const DRAFT_KEY = 'zaguan:agency-draft'

export const defaultValues = {
  cuit: '',
  companyName: '',
  publicName: '',
  email: '',
  phoneNumber: '',
  address: '',
  webURL: '',
  socials: '',
  status: AGENCY_STATUS.PENDING,
  acceptTerms: false,
}

/** Campos obligatorios del backend; alimentan la barra de progreso del resumen. */
export const REQUIRED_FIELDS = [
  'cuit',
  'companyName',
  'publicName',
  'email',
  'phoneNumber',
  'address',
  'acceptTerms',
]

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

function sized(value, { min = 0, max = Infinity }, subject) {
  const trimmed = String(value ?? '').trim()
  if (min > 0 && !trimmed) return `Indique ${subject}.`
  if (trimmed.length < min) return `${capitalize(subject)} debe tener al menos ${min} caracteres.`
  if (trimmed.length > max) return `${capitalize(subject)} no puede superar los ${max} caracteres.`
  return null
}

export const validation = {
  cuit: (value) => {
    const digits = onlyDigits(value)
    if (!digits) return 'Indique el CUIT de la agencia.'
    if (digits.length !== 11) return 'El CUIT debe tener 11 dígitos.'
    if (!isValidCuit(value)) return 'El dígito verificador no coincide. Revise el número.'
    return null
  },

  companyName: (value) => sized(value, AGENCY_LIMITS.companyName, 'la razón social'),

  publicName: (value) => sized(value, AGENCY_LIMITS.publicName, 'el nombre comercial'),

  email: (value) => {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return 'Indique el email corporativo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return 'El email no tiene un formato válido.'
    return sized(trimmed, AGENCY_LIMITS.email, 'el email')
  },

  phoneNumber: (value) => {
    const raw = String(value ?? '').trim()
    if (!raw) return 'Indique el teléfono de contacto.'
    if (!/^\+?[\d\s()-]+$/.test(raw)) return 'Use solo números, espacios, guiones y un + inicial.'

    const { min, max } = AGENCY_LIMITS.phoneNumber
    const normalized = normalizePhone(raw)
    if (normalized.length < min) return `El teléfono debe tener al menos ${min} dígitos.`
    if (normalized.length > max) return `El teléfono no puede superar los ${max} caracteres (con el + del país).`
    return null
  },

  address: (value) => sized(value, AGENCY_LIMITS.address, 'la dirección'),

  webURL: (value) => {
    if (!String(value ?? '').trim()) return null // opcional en el DTO
    if (!isValidWebUrl(value)) return 'Ingrese una dirección web válida (ej. habitatprime.com.ar).'
    return sized(normalizeWebUrl(value), AGENCY_LIMITS.webURL, 'la web')
  },

  socials: (value) =>
    String(value ?? '').trim() ? sized(value, AGENCY_LIMITS.socials, 'las redes') : null,

  acceptTerms: (value) => (value ? null : 'Debe aceptar las condiciones del servicio.'),
}

/**
 * Validación de la edición. Si el CUIT es el que ya estaba guardado no se
 * revisa el dígito verificador: el backend solo exige el largo, y un dato
 * cargado antes con el dígito mal impediría editar cualquier otro campo.
 * Si se cambia, se valida completo.
 */
export function editValidation(savedCuit) {
  return {
    ...validation,
    cuit: (value, values) => {
      if (onlyDigits(value) !== onlyDigits(savedCuit)) return validation.cuit(value, values)
      return onlyDigits(value).length === 11 ? null : 'El CUIT debe tener 11 dígitos.'
    },
  }
}

/** Porcentaje de campos obligatorios ya completados y válidos. */
export function getProgress(values, rules = validation) {
  const completed = REQUIRED_FIELDS.filter((field) => {
    const value = values[field]
    if (typeof value === 'boolean') return value
    if (!String(value ?? '').trim()) return false
    return rules[field]?.(value, values) == null
  })

  return Math.round((completed.length / REQUIRED_FIELDS.length) * 100)
}

export function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY))
    if (!draft || typeof draft !== 'object') return defaultValues

    // Se toman solo las claves conocidas y del tipo esperado: un borrador viejo
    // o manipulado no debe inyectar campos ni romper el render del resumen.
    const restored = { ...defaultValues }
    for (const [key, fallback] of Object.entries(defaultValues)) {
      const value = draft[key]
      if (typeof value === typeof fallback) restored[key] = value
    }
    return restored
  } catch {
    return defaultValues
  }
}

export function saveDraft(values) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
    return true
  } catch {
    return false
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // El almacenamiento local puede no estar disponible (modo privado, cuota llena).
  }
}
