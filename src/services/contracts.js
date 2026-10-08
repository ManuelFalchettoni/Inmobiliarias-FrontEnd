/**
 * API de contratos y de sus partes.
 *
 * Replica `PropertyContractRequest` / `PropertyContractResponse`,
 * `ContractPartyRequest` / `ContractPartyResponse` y los enums `ContractType`,
 * `ContractStatus` y `ContractRole` del backend.
 */
import { del, get, post, put } from './api.js'

export const CONTRACTS_ENDPOINT = '/api/property_contracts'
export const PARTIES_ENDPOINT = '/api/contract_parties'

const toLabelMap = (options) => Object.fromEntries(options.map((o) => [o.value, o.label]))

/** Refleja `ContractType`. */
export const CONTRACT_TYPE_OPTIONS = [
  { value: 'RENT', label: 'Alquiler' },
  { value: 'SALE', label: 'Venta' },
]
export const CONTRACT_TYPE_LABEL = toLabelMap(CONTRACT_TYPE_OPTIONS)

/** Refleja `ContractStatus`. */
export const CONTRACT_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Vigente' },
  { value: 'FINISHED', label: 'Finalizado' },
  { value: 'CANCELLED', label: 'Cancelado' },
]
export const CONTRACT_STATUS_LABEL = toLabelMap(CONTRACT_STATUS_OPTIONS)
export const CONTRACT_STATUS_COLOR = { ACTIVE: 'teal', FINISHED: 'gray', CANCELLED: 'red' }

/** Refleja `ContractRole`. */
export const CONTRACT_ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Propietario' },
  { value: 'TENANT', label: 'Inquilino' },
  { value: 'BUYER', label: 'Comprador' },
  { value: 'GUARANTOR', label: 'Garante' },
]
export const CONTRACT_ROLE_LABEL = toLabelMap(CONTRACT_ROLE_OPTIONS)

/**
 * Roles que tienen sentido según el tipo de contrato. El backend acepta
 * cualquiera; esto es solo lo que ofrece la pantalla.
 */
export const ROLES_BY_TYPE = {
  RENT: ['OWNER', 'TENANT', 'GUARANTOR'],
  SALE: ['OWNER', 'BUYER'],
}

/**
 * `@Positive` y `@Digits(integer = 15, fraction = 2)` del `PropertyContractRequest`.
 * El máximo exacto (15 nueves con centavos) no entra en un número de JS, así
 * que el tope es la parte entera.
 */
export const CONTRACT_LIMITS = { amount: { min: 0.01, max: 999999999999999, decimals: 2 } }

// -------------------------------------------------------------- Contratos

/** Valores del formulario -> `PropertyContractRequest`. */
export function toContractRequest(values) {
  return {
    propertyId: Number(values.propertyId),
    type: values.type,
    status: values.status,
    amount: Number(values.amount),
    currency: values.currency,
    startDate: values.startDate,
    // Una venta no tiene fecha de fin.
    endDate: values.type === 'SALE' ? null : values.endDate || null,
    documentURL: String(values.documentURL ?? '').trim(),
  }
}

/** Inversa de `toContractRequest`. Las fechas llegan como "yyyy-MM-dd", lo que come el input. */
export function toContractFormValues(contract) {
  return {
    propertyId: contract.propertyId != null ? String(contract.propertyId) : null,
    type: contract.type,
    status: contract.status,
    amount: contract.amount ?? '',
    currency: contract.currency,
    startDate: contract.startDate ?? '',
    endDate: contract.endDate ?? '',
    documentURL: contract.documentURL ?? '',
  }
}

/** Un contrato del response -> request, para un `PUT` que cambia un solo campo. */
export const contractToRequest = (contract, changes = {}) => ({
  propertyId: contract.propertyId,
  type: contract.type,
  status: contract.status,
  amount: contract.amount,
  currency: contract.currency,
  startDate: contract.startDate,
  endDate: contract.endDate ?? null,
  documentURL: contract.documentURL,
  ...changes,
})

/**
 * GET -> `Page<PropertyContractResponse>`. Solo acepta `page` y `size`: sin
 * filtros ni orden (sale por id) y sin tope de página.
 */
export const listContracts = ({ page = 0, size = 20 } = {}, options) =>
  get(`${CONTRACTS_ENDPOINT}?page=${page}&size=${size}`, options)

export const findContract = (id, options) => get(`${CONTRACTS_ENDPOINT}/${id}`, options)

/** POST -> 201. El backend no valida que la propiedad exista. */
export const createContract = (request, options) => post(CONTRACTS_ENDPOINT, request, options)

/** En el `PUT` el `propertyId` se ignora: un contrato no cambia de propiedad. */
export const updateContract = (id, request, options) => put(`${CONTRACTS_ENDPOINT}/${id}`, request, options)

/** No borra: pasa el contrato a `CANCELLED`. Responde 204. */
export const cancelContract = (id, options) => del(`${CONTRACTS_ENDPOINT}/${id}`, options)

/** Fecha local de hoy en "yyyy-MM-dd", comparable como texto con un `LocalDate`. */
function todayIso() {
  const now = new Date()
  // padStart completa con ceros a la izquierda: 3 -> "03".
  const pad = (n) => String(n).padStart(2, '0')
  // getMonth() cuenta desde 0 (enero = 0), por eso el + 1.
  // Comparar "yyyy-MM-dd" como texto da el mismo orden que como fecha: año,
  // mes y día van de mayor a menor importancia.
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Vigente pero con la fecha de fin ya pasada: el backend no cambia el estado
 * solo, así que hay que pasarlo a finalizado o renovarlo a mano.
 */
export const isContractOverdue = (contract) =>
  contract.status === 'ACTIVE' && Boolean(contract.endDate) && contract.endDate < todayIso()

/** "01/03/2024 → 01/03/2026", o "Desde 01/03/2024" si no tiene fin. */
export function formatContractTerm({ startDate, endDate }) {
  // "2024-03-01" -> ["2024", "03", "01"] -> ["01", "03", "2024"] -> "01/03/2024".
  const format = (value) => (value ? value.split('-').reverse().join('/') : '')
  return endDate ? `${format(startDate)} → ${format(endDate)}` : `Desde ${format(startDate)}`
}

// ------------------------------------------------------------------ Partes

/** Valores del formulario -> `ContractPartyRequest`. */
export const toPartyRequest = (contractId, values) => ({
  contractId: Number(contractId),
  peopleId: Number(values.peopleId),
  role: values.role,
  comments: String(values.comments ?? '').trim() || null,
})

/** Una parte del response -> request, para el `PUT`. */
export const partyToRequest = (party, changes = {}) => ({
  contractId: party.contractId,
  peopleId: party.peopleId,
  role: party.role,
  comments: party.comments ?? null,
  ...changes,
})

const ALL_PAGE_SIZE = 500

/**
 * Todas las partes de todos los contratos. El backend no filtra por contrato,
 * así que se recorren las páginas y se agrupa del lado del cliente. Cuando
 * exista `?contractId=` en el backend, esto pasa a ser un solo pedido.
 */
export async function listAllParties(options) {
  const parties = []
  // Mismo recorrido de páginas que listAllOwners (owners.js): pide hasta que
  // Spring marca `last` en la respuesta.
  for (let page = 0; ; page += 1) {
    const result = await get(`${PARTIES_ENDPOINT}?page=${page}&size=${ALL_PAGE_SIZE}`, options)
    parties.push(...result.content)
    if (result.last || result.content.length === 0) return parties
  }
}

/** Agrupa partes por contrato: `{ [contractId]: party[] }`. */
export function groupPartiesByContract(parties) {
  const groups = {}
  // `??=` asigna solo si no hay valor: la primera parte de cada contrato crea su
  // lista vacía y las siguientes reutilizan la que ya existe.
  for (const party of parties) (groups[party.contractId] ??= []).push(party)
  return groups
}

/** POST -> 201. 404 si el contrato o la persona no existen. */
export const createParty = (request, options) => post(PARTIES_ENDPOINT, request, options)

export const updateParty = (id, request, options) => put(`${PARTIES_ENDPOINT}/${id}`, request, options)

/** Borrado físico: 204. */
export const deleteParty = (id, options) => del(`${PARTIES_ENDPOINT}/${id}`, options)
