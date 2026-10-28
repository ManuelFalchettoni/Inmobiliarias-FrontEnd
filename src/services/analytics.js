/**
 * API de Analítica: `GET /api/analytics/summary`, los números del panel ya
 * contados por el backend en un solo response.
 *
 * Los mapas (`byType`, `leadsByStage`, ...) traen siempre todas las claves del
 * enum, en 0 las vacías: la pantalla puede recorrerlos sin preguntar si existen.
 */
import { get } from './api.js'

/**
 * `agencyId` solo lo tiene en cuenta el admin (sin él ve todas); el resto ve
 * siempre su inmobiliaria. Un usuario sin inmobiliaria recibe 403.
 */
export function getAnalyticsSummary({ agencyId } = {}, options) {
  const query = agencyId != null ? `?agencyId=${encodeURIComponent(agencyId)}` : ''
  return get(`/api/analytics/summary${query}`, options)
}
