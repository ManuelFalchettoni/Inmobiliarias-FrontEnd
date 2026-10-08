import { useEffect, useState } from 'react'

/**
 * Caché de registros por id, compartida entre pantallas. Las respuestas del
 * CRM y de personas traen solo ids (`peopleId`, `propertyId`, `userId`,
 * `agencyId`), así que un listado de 20 filas pediría lo mismo muchas veces.
 * Se guarda la promesa, no el resultado, para que dos pedidos simultáneos del
 * mismo id compartan el viaje. Los errores no se cachean.
 */
// La caché vive FUERA de los componentes (a nivel de módulo): la comparten
// todas las pantallas y sobrevive al cambiar de página dentro de la app.
// Es un Map por recurso: caches.get('people') -> Map(id -> promesa).
const caches = new Map()

function cacheFor(resource) {
  if (!caches.has(resource)) caches.set(resource, new Map())
  return caches.get(resource)
}

export function fetchCached(resource, id, fetcher) {
  const cache = cacheFor(resource)
  if (!cache.has(id)) {
    // Si el pedido falla se borra de la caché (para poder reintentar) y se
    // relanza el error para que quien espera la promesa se entere.
    const promise = fetcher(id).catch((error) => {
      cache.delete(id)
      throw error
    })
    cache.set(id, promise)
  }
  // Si ya estaba, se devuelve la misma promesa: no se hace otro pedido.
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
  // `new Set` saca los ids repetidos (varios leads de la misma persona) y se
  // ordenan para que [3, 1] y [1, 3] den la misma clave "1,3".
  const unique = [...new Set(ids.filter((id) => id != null))].sort((a, b) => a - b)
  // El array de ids es nuevo en cada render; la clave en texto solo cambia si
  // cambian los ids de verdad. Por eso el efecto depende de `key` y no de `ids`.
  const key = unique.join(',')
  const [result, setResult] = useState({ key: null, records: {} })

  useEffect(() => {
    if (!key) return undefined
    // Bandera para ignorar la respuesta si el componente se desmontó o cambió
    // la clave mientras se esperaba.
    let cancelled = false
    const list = key.split(',').map(Number)

    // allSettled: una persona que falla (borrada) no hace perder las demás.
    Promise.allSettled(list.map((id) => fetchCached(resource, id, fetcher))).then((results) => {
      if (cancelled) return
      // Arma { 3: {persona}, 7: null, ... } uniendo cada id con su resultado.
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
