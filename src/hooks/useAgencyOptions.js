import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../queries/keys.js'
import { selectState } from '../queries/status.js'
import { listAgencies } from '../services/agencies.js'

const PARAMS = { size: 100, sort: 'publicName,asc', active: true }

/**
 * Agencias activas para un Select. El tope de página del backend es 100: si
 * algún día hay más, esto tiene que pasar a un Select con búsqueda remota.
 *
 * Un "hook propio": una función que empieza con `use` y usa otros hooks. Saca la
 * lógica de carga del componente para reutilizarla en varios formularios.
 */
export function useAgencyOptions(currentId) {
  // useQuery pide los datos y los guarda en la caché con esa clave. Si otro
  // formulario ya los pidió hace poco, los devuelve al instante.
  const query = useQuery({
    queryKey: queryKeys.agencies.list(PARAMS),
    queryFn: ({ signal }) => listAgencies(PARAMS, { signal }),
    // `select` transforma la respuesta antes de entregarla: del Page de Spring
    // a la lista { value, label } que espera el Select (value como texto).
    select: (page) =>
      page.content.map((agency) => ({
        value: String(agency.id),
        label: `${agency.publicName} (#${agency.id})`,
      })),
  })

  const loaded = query.data ?? []
  // Un registro cuya agencia ya no está activa igual tiene que mostrar su valor.
  const missing = currentId && !loaded.some((option) => option.value === currentId)
  const options = missing ? [{ value: currentId, label: `Agencia #${currentId}` }, ...loaded] : loaded

  return { ...selectState(query), options }
}
