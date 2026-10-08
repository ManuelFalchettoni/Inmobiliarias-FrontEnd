/**
 * Claves de caché ("query keys") de React Query, en un solo lugar.
 *
 * Una clave es un array que identifica un dato: ['properties', 'detail', 7] es
 * la propiedad 7. Las claves son jerárquicas: invalidar ['properties'] marca
 * como viejo TODO lo que empieza así (listados, detalles y el total del menú),
 * y React Query vuelve a pedir lo que esté en pantalla.
 *
 * Los ids se pasan por Number: useParams entrega "7" (texto) y la respuesta del
 * backend trae 7 (número). Con la misma clave, el detalle que pide una pantalla
 * y el que pide useLookup comparten la caché.
 */
function resourceKeys(name) {
  return {
    all: [name],
    lists: () => [name, 'list'],
    list: (params) => [name, 'list', params],
    // Sin id (un Select vacío) la clave queda con null, no con Number(null) = 0.
    detail: (id) => [name, 'detail', id == null ? null : Number(id)],
    total: () => [name, 'total'],
  }
}

export const queryKeys = {
  properties: resourceKeys('properties'),
  agencies: resourceKeys('agencies'),
  users: resourceKeys('users'),
  people: resourceKeys('people'),
  leads: resourceKeys('leads'),
  contracts: resourceKeys('contracts'),
  // Partes y dueños se traen siempre completos (el backend no los filtra).
  contractParties: { all: ['contract-parties'] },
  propertyOwners: { all: ['property-owners'] },
}

/**
 * Lo que cuelga de un lead: ['leads', 'detail', 7, 'offers']. Al estar debajo
 * de la clave del lead, invalidar el lead refresca también sus ofertas,
 * historial y alertas.
 */
export const leadChildKey = (leadId, child) => [...queryKeys.leads.detail(leadId), child]
