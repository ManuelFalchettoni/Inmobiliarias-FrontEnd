/**
 * Formato de fechas del backend. Los `LocalDateTime` llegan sin zona
 * ("2026-10-10T10:00:00"), y `new Date` los interpreta como hora local, que es
 * lo que corresponde: el servidor y el panel están en el mismo huso.
 */

// Intl.DateTimeFormat es el formateador de fechas del navegador. 'es-AR' da el
// orden día/mes/año. Se crean una sola vez, afuera de las funciones, porque
// armarlos en cada llamada es más lento.
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

// Una fecha inválida no es null: es un Date cuyo getTime() da NaN. Por eso se
// revisa con Number.isNaN y, si no sirve, se muestra un guion.

/** "2026-10-08T10:41:47" -> "08/10/2026". */
export function formatDate(value) {
  const date = parse(value)
  return date && !Number.isNaN(date.getTime()) ? DATE.format(date) : '—'
}

/** "2026-10-08T10:41:47" -> "08/10/2026, 10:41". */
export function formatDateTime(value) {
  const date = parse(value)
  return date && !Number.isNaN(date.getTime()) ? DATE_TIME.format(date) : '—'
}

/**
 * Valor de un `<input type="datetime-local">` ("2026-10-10T10:00") al
 * `LocalDateTime` que espera el backend, con segundos.
 * `slice(0, 16)` se queda con "yyyy-MM-ddTHH:mm" (los primeros 16 caracteres).
 */
export const toLocalDateTime = (value) => (value ? `${value.slice(0, 16)}:00` : null)

/** Inversa de `toLocalDateTime`, para precargar el input. */
export const toDateTimeInput = (value) => (value ? String(value).slice(0, 16) : '')
