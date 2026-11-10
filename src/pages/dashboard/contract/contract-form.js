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

// Válido si `new URL` lo puede analizar Y es http o https. Así se descartan
// textos sueltos y esquemas peligrosos como `javascript:`.
function isUrl(value) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Hoy en hora local como "yyyy-MM-dd", el formato del input de fecha. */
export function todayISO() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Reglas del formulario. En un alta el estado solo puede ser "Vigente" y las
 * fechas no pueden ser anteriores a hoy. En una edición una fecha ya guardada
 * en el pasado se acepta mientras no se cambie (un contrato vigente empezó
 * antes de hoy); si se cambia, tampoco puede quedar en el pasado.
 */
export function contractValidation({ isEdit = false, initialValues = {} } = {}) {
  const notInPast = (field, value) => {
    if (!value) return null
    if (isEdit && value === initialValues[field]) return null
    return value < todayISO() ? 'No puede ser anterior a hoy.' : null
  }

  return {
    propertyId: required('Elija la propiedad.'),
    type: required('Elija el tipo.'),
    status: (value) => {
      if (!value) return 'Elija el estado.'
      if (!isEdit && value !== 'ACTIVE') return 'Un contrato nuevo tiene que estar vigente.'
      return null
    },
    currency: required('Elija la moneda.'),

    amount: (value) => {
      if (value === '' || value == null) return 'Indique el monto.'
      const amount = Number(value)
      if (!Number.isFinite(amount)) return 'Debe ser un número.'
      if (amount < CONTRACT_LIMITS.amount.min) return 'Debe ser mayor a 0.'
      if (amount > CONTRACT_LIMITS.amount.max) return 'El monto es demasiado grande.'
      return null
    },

    startDate: (value) => (value ? notInPast('startDate', value) : 'Indique la fecha de inicio.'),

    // Opcional en el DTO; en un alquiler conviene cargarla, pero no se exige.
    endDate: (value, values) => {
      if (values.type === 'SALE' || !value) return null
      // Las fechas son texto "yyyy-MM-dd": compararlas con `<` da el orden
      // cronológico, porque van de año a día.
      if (values.startDate && value <= values.startDate) return 'Tiene que ser posterior al inicio.'
      return notInPast('endDate', value)
    },

    documentURL: (value) => {
      const text = String(value ?? '').trim()
      if (!text) return 'Indique el link al documento del contrato.'
      if (!isUrl(text)) return 'Tiene que ser un link completo (https://...).'
      return null
    },
  }
}
