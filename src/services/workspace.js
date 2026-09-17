/**
 * Totales del espacio de trabajo para el pie de la navegación.
 *
 * Los tres listados del backend devuelven un `Page<T>` de Spring, así que el
 * total sale de `totalElements` pidiendo una sola fila. Son las únicas métricas
 * que la API puede dar hoy: no hay registro de visitas ni de conversión.
 */
import { get } from './api.js'

const TOTALS = [
  { key: 'properties', label: 'Propiedades activas', endpoint: '/api/properties' },
  { key: 'agencies', label: 'Agencias activas', endpoint: '/api/agencies' },
  { key: 'users', label: 'Usuarios activos', endpoint: '/api/users' },
]

/** Descriptores sin dato, para pintar el bloque antes de la primera respuesta. */
export const emptyWorkspaceTotals = TOTALS.map((entry) => ({ ...entry, total: null }))

/**
 * Nunca rechaza: si el backend no está levantado cada total queda en `null` y
 * la barra lateral muestra un guion en lugar de romper el panel entero.
 */
export async function getWorkspaceTotals(options) {
  const results = await Promise.allSettled(
    TOTALS.map(({ endpoint }) => get(`${endpoint}?active=true&page=0&size=1`, options)),
  )

  return TOTALS.map((entry, index) => {
    const result = results[index]
    const total = result.status === 'fulfilled' ? result.value?.totalElements : null

    return { ...entry, total: Number.isFinite(total) ? total : null }
  })
}
