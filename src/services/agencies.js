/**
 * API de agencias y normalización de datos.
 *
 * Los límites y el vocabulario replican el contrato real del backend
 * (`AgencyRequest` / `AgencyResponse` / `AgencyStatus`). Cualquier cambio acá
 * debe ir acompañado del cambio equivalente en el DTO de Java.
 */
import { get, pageQuery, post } from './api.js'

export const AGENCIES_ENDPOINT = '/api/agencies'

/** Refleja `enums/agency/AgencyStatus`. */
export const AGENCY_STATUS = {
  PENDING: 'PENDING',
  VERIFY: 'VERIFY',
  DENIED: 'DENIED',
}

export const AGENCY_STATUS_OPTIONS = [
  { value: AGENCY_STATUS.PENDING, label: 'Pendiente de verificación' },
  { value: AGENCY_STATUS.VERIFY, label: 'Verificada' },
  { value: AGENCY_STATUS.DENIED, label: 'Rechazada' },
]

/** Etiqueta corta para chips y badges donde el texto completo no entra. */
export const AGENCY_STATUS_SHORT_LABEL = {
  [AGENCY_STATUS.PENDING]: 'Pendiente',
  [AGENCY_STATUS.VERIFY]: 'Verificada',
  [AGENCY_STATUS.DENIED]: 'Rechazada',
}

export const AGENCY_STATUS_COLOR = {
  [AGENCY_STATUS.PENDING]: 'yellow',
  [AGENCY_STATUS.VERIFY]: 'teal',
  [AGENCY_STATUS.DENIED]: 'red',
}

/**
 * Refleja las anotaciones `@Size` del `AgencyRequest`. Validar con los mismos
 * números del lado del cliente evita viajes que el backend rechazaría con 400.
 */
export const AGENCY_LIMITS = {
  cuit: { min: 11, max: 13 },
  companyName: { min: 3, max: 30 },
  publicName: { min: 3, max: 30 },
  email: { min: 3, max: 100 },
  password: { min: 8, max: 20 },
  phoneNumber: { min: 8, max: 15 },
  address: { min: 6, max: 40 },
  webURL: { max: 255 },
  socials: { max: 255 },
}

/** Campos con restricción `unique` en la tabla `agencies`: un 409 apunta a alguno de estos. */
export const AGENCY_UNIQUE_FIELDS = ['cuit', 'companyName', 'email', 'phoneNumber', 'address']

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

export const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

/** Aplica la máscara `XX-XXXXXXXX-X` (13 caracteres, dentro del rango 11–13 del backend). */
export function formatCuit(value) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

/** Verifica los 11 dígitos y el dígito verificador (módulo 11). */
export function isValidCuit(value) {
  const digits = onlyDigits(value)
  if (digits.length !== 11) return false

  const sum = CUIT_WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(digits[index]), 0)
  const remainder = 11 - (sum % 11)
  const checkDigit = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder

  return checkDigit === Number(digits[10])
}

/**
 * Compacta el teléfono a `+` y dígitos. El backend cuenta caracteres crudos
 * (8–15), así que enviar "+54 9 11 1234-5678" daría 400 por longitud.
 */
export function normalizePhone(value) {
  const raw = String(value ?? '').trim()
  const digits = onlyDigits(raw)
  return raw.startsWith('+') ? `+${digits}` : digits
}

/** Agrega el esquema si falta, para guardar siempre una URL absoluta. */
export function normalizeWebUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

export function isValidWebUrl(value) {
  const normalized = normalizeWebUrl(value)
  if (!normalized) return true // campo opcional

  try {
    const { hostname } = new URL(normalized)
    return hostname.includes('.') && !hostname.startsWith('.') && !hostname.endsWith('.')
  } catch {
    return false
  }
}

/** Traduce los valores del formulario al `AgencyRequest` que espera el backend. */
export function toAgencyRequest(values) {
  const webURL = normalizeWebUrl(values.webURL)
  const socials = values.socials.trim()

  return {
    cuit: formatCuit(values.cuit),
    companyName: values.companyName.trim(),
    publicName: values.publicName.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    phoneNumber: normalizePhone(values.phoneNumber),
    address: values.address.trim().replace(/\s+/g, ' '),
    // Opcionales en el DTO: sin valor se mandan como null en lugar de "".
    webURL: webURL || null,
    socials: socials || null,
    status: values.status,
  }
}

/** POST /api/agencies -> 201 con el `AgencyResponse` creado. */
export const createAgency = (agencyRequest, options) => post(AGENCIES_ENDPOINT, agencyRequest, options)

/**
 * GET /api/agencies -> `Page<AgencyResponse>`. Filtro: `active` (por defecto
 * `true` en el backend). El `size` tope es 100 (`max-page-size`).
 */
export const listAgencies = (params, options) =>
  get(`${AGENCIES_ENDPOINT}?${pageQuery(params)}`, options)
