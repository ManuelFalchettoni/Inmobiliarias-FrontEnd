/**
 * Totales del espacio de trabajo para el pie de la navegación.
 *
 * Los tres listados del backend devuelven un `Page<T>` de Spring, así que el
 * total sale de `totalElements` pidiendo una sola fila. Son las únicas métricas
 * que la API puede dar hoy: no hay registro de visitas ni de conversión.
 */
import { get } from './api.js'

// Los tres totales como datos: agregar uno nuevo es sumar una fila acá.
// `resource` es el nombre en queryKeys: invalidar ese recurso (por ejemplo,
// después de dar de alta una propiedad) actualiza también su total.
export const WORKSPACE_TOTALS = [
  { key: 'properties', resource: 'properties', label: 'Propiedades activas', endpoint: '/api/properties' },
  { key: 'agencies', resource: 'agencies', label: 'Agencias activas', endpoint: '/api/agencies' },
  { key: 'users', resource: 'users', label: 'Usuarios activos', endpoint: '/api/users' },
]

/** Pide una sola fila (`size=1`): solo interesa `totalElements`. */
export async function fetchWorkspaceTotal(endpoint, options) {
  const page = await get(`${endpoint}?active=true&page=0&size=1`, options)
  return page.totalElements
}
