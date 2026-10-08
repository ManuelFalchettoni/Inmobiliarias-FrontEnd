/**
 * Formato de fechas del backend. Los `LocalDateTime` llegan sin zona
 * ("2026-10-10T10:00:00"), y `new Date` los interpreta como hora local, que es
 * lo que corresponde: el servidor y el panel están en el mismo huso.
 */
const DATE = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const DATE_TIME = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const parse = (value) => (value ? new Date(value) : null)

export function formatDate(value) {
  const date = parse(value)
  return date && !Number.isNaN(date.getTime()) ? DATE.format(date) : '—'
}

export function formatDateTime(value) {
  const date = parse(value)
  return date && !Number.isNaN(date.getTime()) ? DATE_TIME.format(date) : '—'
}

/**
 * Valor de un `<input type="datetime-local">` ("2026-10-10T10:00") al
 * `LocalDateTime` que espera el backend, con segundos.
 */
export const toLocalDateTime = (value) => (value ? `${value.slice(0, 16)}:00` : null)

/** Inversa de `toLocalDateTime`, para precargar el input. */
export const toDateTimeInput = (value) => (value ? String(value).slice(0, 16) : '')
