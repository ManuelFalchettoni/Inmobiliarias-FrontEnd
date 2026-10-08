import { useEffect, useState } from 'react'

/**
 * Caché de registros por id, compartida entre pantallas. Las respuestas del
 * CRM y de personas traen solo ids (`peopleId`, `propertyId`, `userId`,
 * `agencyId`), así que un listado de 20 filas pediría lo mismo muchas veces.
 * Se guarda la promesa, no el resultado, para que dos pedidos simultáneos del
 * mismo id compartan el viaje. Los errores no se cachean.
 */
const caches = new Map()

function cacheFor(resource) {
  if (!caches.has(resource)) caches.set(resource, new Map())
  return caches.get(resource)
}

export function fetchCached(resource, id, fetcher) {
  const cache = cacheFor(resource)
  if (!cache.has(id)) {
    const promise = fetcher(id).catch((error) => {
      cache.delete(id)
      throw error
    })
    cache.set(id, promise)
  }
  return cache.get(id)
}

/** Para después de un PUT: la próxima lectura vuelve a pedir el registro. */
export function forgetCached(resource, id) {
  cacheFor(resource).delete(id)
}

/**
 * Trae los registros de `ids` y devuelve `{ [id]: registro }`. Un id que falla
 * (borrado, dado de baja) queda en `null` para que la pantalla muestre el id
 * en lugar de romperse.
 */
export function useLookup(resource, ids, fetcher) {
  const unique = [...new Set(ids.filter((id) => id != null))].sort((a, b) => a - b)
  const key = unique.join(',')
  const [result, setResult] = useState({ key: null, records: {} })

  useEffect(() => {
    if (!key) return undefined
    let cancelled = false
    const list = key.split(',').map(Number)

    Promise.allSettled(list.map((id) => fetchCached(resource, id, fetcher))).then((results) => {
      if (cancelled) return
      const records = Object.fromEntries(
        list.map((id, index) => [id, results[index].status === 'fulfilled' ? results[index].value : null]),
      )
      setResult({ key, records })
    })

    return () => {
      cancelled = true
    }
    // `fetcher` es una función de módulo: no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, key])

  // Mientras llega el pedido nuevo se siguen mostrando los nombres anteriores.
  return result.records
}
