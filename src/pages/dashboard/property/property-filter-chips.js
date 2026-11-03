import {
  OPERATION_TYPE_LABEL,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_OCCUPANCY_LABEL,
  PROPERTY_TYPE_LABEL,
} from '../../../services/properties.js'

/** Los de texto, con el nombre que se ve en el chip. */
const TEXT_CHIPS = [
  ['city', 'Ciudad'],
  ['county', 'Partido'],
  ['province', 'Provincia'],
  ['address', 'Dirección'],
]

/** Los de varios valores: el chip muestra las etiquetas separadas por coma. */
const MULTI_CHIPS = [
  ['type', PROPERTY_TYPE_LABEL],
  ['condition', PROPERTY_CONDITION_LABEL],
  ['occupancy', PROPERTY_OCCUPANCY_LABEL],
]

/** Los rangos desde/hasta: un solo chip por par. */
const RANGE_CHIPS = [
  ['minRooms', 'maxRooms', 'Ambientes', ''],
  ['minSize', 'maxSize', 'Superficie', ' m²'],
  ['minFloor', 'maxFloor', 'Piso', ''],
  ['minYear', 'maxYear', 'Año', ''],
]

const formatNumber = (value) => Number(value).toLocaleString('es-AR')

/** "2 – 4", "desde 2" o "hasta 4"; null si el rango está vacío. */
function rangeText(min, max, suffix = '', format = (v) => v) {
  if (min && max) return `${format(min)} – ${format(max)}${suffix}`
  if (min) return `desde ${format(min)}${suffix}`
  if (max) return `hasta ${format(max)}${suffix}`
  return null
}

/**
 * Los filtros aplicados, listos para mostrar como chips: `{ key, label, names }`.
 * `names` son los parámetros de la URL que se borran al quitar el chip.
 */
export function activeFilterChips(filters) {
  const chips = []

  if (filters.operationType) {
    chips.push({ key: 'operationType', label: OPERATION_TYPE_LABEL[filters.operationType], names: ['operationType'] })
  }

  const precio = rangeText(filters.minPrice, filters.maxPrice, '', formatNumber)
  if (precio) {
    chips.push({
      key: 'price',
      label: `Precio: ${filters.currency ?? ''} ${precio}`.replace('  ', ' '),
      names: ['minPrice', 'maxPrice', 'currency'],
    })
  } else if (filters.currency) {
    chips.push({ key: 'currency', label: `Moneda: ${filters.currency}`, names: ['currency'] })
  }

  for (const [name, label] of TEXT_CHIPS) {
    if (filters[name]) chips.push({ key: name, label: `${label}: ${filters[name]}`, names: [name] })
  }

  for (const [name, labels] of MULTI_CHIPS) {
    if (filters[name]) {
      const texto = filters[name]
        .split(',')
        .map((value) => labels[value] ?? value)
        .join(', ')
      chips.push({ key: name, label: texto, names: [name] })
    }
  }

  for (const [min, max, label, suffix] of RANGE_CHIPS) {
    const texto = rangeText(filters[min], filters[max], suffix)
    if (texto) chips.push({ key: min, label: `${label} ${texto}`, names: [min, max] })
  }

  return chips
}

