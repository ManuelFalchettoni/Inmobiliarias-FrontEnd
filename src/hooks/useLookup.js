import { useQueries } from '@tanstack/react-query'

import { queryKeys } from '../queries/keys.js'

/**
 * De ids a registros. Las respuestas del CRM, de contratos y de personas traen
 * solo ids (`peopleId`, `propertyId`, `userId`, `agencyId`), así que para
 * mostrar nombres hay que pedir cada registro.
 *
 * `useQueries` lanza una consulta por id, todas en paralelo. La clave de cada
 * una es la misma que usa la pantalla de detalle ([recurso, 'detail', id]):
 * React Query las comparte, así un registro que ya se pidió no se vuelve a
 * pedir, y dos filas con la misma persona hacen un solo pedido.
 *
 * Devuelve `{ [id]: registro }`. Mientras carga, o si falla (dado de baja,
 * inexistente), el valor es `null` y la pantalla muestra el id.
 *
 * @param {'people' | 'properties' | 'users' | 'agencies'} resource nombre en queryKeys
 * @param {Array<number|null>} ids puede traer repetidos y nulls
 * @param {(id, options) => Promise} fetcher la función `findX` del servicio
 */
export function useLookup(resource, ids, fetcher) {
  // `new Set` saca los repetidos; los null (por ejemplo un usuario sin agencia) se descartan.
  const unique = [...new Set(ids.filter((id) => id != null).map(Number))]

  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: queryKeys[resource].detail(id),
      // React Query pasa un `signal` para cancelar el pedido si ya no hace falta.
      queryFn: ({ signal }) => fetcher(id, { signal }),
    })),
  })

  // Une cada id con su resultado: los resultados vienen en el mismo orden que `unique`.
  return Object.fromEntries(unique.map((id, index) => [id, results[index].data ?? null]))
}
