/**
 * Valores por defecto y validación del alta / edición de contratos. Replica
 * las anotaciones del `PropertyContractRequest`.
 */
import { CONTRACT_LIMITS } from '../../../services/contracts.js'

export const contractDefaultValues = {
  propertyId: null,
  type: 'RENT',
  status: 'ACTIVE',
  amount: '',
  currency: 'ARS',
  startDate: '',
  endDate: '',
  documentURL: '',
}

const required = (message) => (value) => (value ? null : message)

function isUrl(value) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export const contractValidation = {
  propertyId: required('Elija la propiedad.'),
  type: required('Elija el tipo.'),
  status: required('Elija el estado.'),
  currency: required('Elija la moneda.'),

  amount: (value) => {
    if (value === '' || value == null) return 'Indique el monto.'
    const amount = Number(value)
    if (!Number.isFinite(amount)) return 'Debe ser un número.'
    if (amount < CONTRACT_LIMITS.amount.min) return 'Debe ser mayor a 0.'
    if (amount > CONTRACT_LIMITS.amount.max) return 'El monto es demasiado grande.'
    return null
  },

  startDate: required('Indique la fecha de inicio.'),

  // Opcional en el DTO; en un alquiler conviene cargarla, pero no se exige.
  endDate: (value, values) => {
    if (values.type === 'SALE' || !value) return null
    if (values.startDate && value < values.startDate) return 'No puede ser anterior al inicio.'
    return null
  },

  documentURL: (value) => {
    const text = String(value ?? '').trim()
    if (!text) return 'Indique el link al documento del contrato.'
    if (!isUrl(text)) return 'Tiene que ser un link completo (https://...).'
    return null
  },
}
