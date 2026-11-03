import { CONTRACT_STATUS_LABEL, CONTRACT_TYPE_LABEL } from '../../../services/contracts.js'
import { formatDate } from '../../../services/format.js'

// "yyyy-MM-dd" solo lo leería `new Date` como medianoche UTC (el día anterior
// acá): con la hora pegada queda en hora local.
const formatDay = (value) => formatDate(`${value}T00:00:00`)

/** "a – b", "desde a" o "hasta b"; null si el rango está vacío. */
function rangeText(min, max, format) {
  if (min && max) return `${format(min)} – ${format(max)}`
  if (min) return `desde ${format(min)}`
  if (max) return `hasta ${format(max)}`
  return null
}

/**
 * Los filtros aplicados, listos para mostrar como chips: `{ key, label, names }`.
 * `propertyOptions` da el nombre de la propiedad elegida (la URL tiene solo el id).
 */
export function contractFilterChips(filters, propertyOptions) {
  const chips = []

  if (filters.propertyId) {
    const option = propertyOptions.find((o) => o.value === filters.propertyId)
    chips.push({ key: 'propertyId', label: option?.label ?? `Propiedad #${filters.propertyId}`, names: ['propertyId'] })
  }
  if (filters.status) {
    chips.push({ key: 'status', label: CONTRACT_STATUS_LABEL[filters.status] ?? filters.status, names: ['status'] })
  }
  if (filters.type) {
    chips.push({ key: 'type', label: CONTRACT_TYPE_LABEL[filters.type] ?? filters.type, names: ['type'] })
  }

  const formatAmount = (value) => Number(value).toLocaleString('es-AR')
  const monto = rangeText(filters.minAmount, filters.maxAmount, formatAmount)
  if (monto) {
    chips.push({
      key: 'amount',
      label: `Monto: ${filters.currency ?? ''} ${monto}`.replace('  ', ' '),
      names: ['minAmount', 'maxAmount', 'currency'],
    })
  } else if (filters.currency) {
    chips.push({ key: 'currency', label: `Moneda: ${filters.currency}`, names: ['currency'] })
  }

  const empieza = rangeText(filters.startFrom, filters.startTo, formatDay)
  if (empieza) chips.push({ key: 'start', label: `Empieza ${empieza}`, names: ['startFrom', 'startTo'] })
  const vence = rangeText(filters.endFrom, filters.endTo, formatDay)
  if (vence) chips.push({ key: 'end', label: `Vence ${vence}`, names: ['endFrom', 'endTo'] })

  return chips
}
