import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../context/auth-context.js'
import { queryKeys } from '../queries/keys.js'
import { selectState } from '../queries/status.js'
import { findAgency, listAgencies } from '../services/agencies.js'
import { USER_ROL } from '../services/users.js'

const PARAMS = { size: 100, sort: 'publicName,asc', active: true }

const toOption = (agency) => ({
  value: String(agency.id),
  label: `${agency.publicName} (#${agency.id})`,
})

/**
 * Valor inicial del `agencyId` en un alta. AGENCY y AGENT cargan siempre en su
 * inmobiliaria (el backend ignora otra), y el campo sigue siendo obligatorio por
 * validación: va el suyo. El admin elige.
 */
export const defaultAgencyId = (user) =>
  user?.rol !== USER_ROL.ADMIN && user?.agencyId != null ? String(user.agencyId) : null

/**
 * Agencias activas para un Select. El tope de página del backend es 100: si
 * algún día hay más, esto tiene que pasar a un Select con búsqueda remota.
 *
 * Listar inmobiliarias es solo del admin (403 para el resto): para AGENCY y
 * AGENT la única opción es la suya, que sí pueden traer con `GET /{id}`, y
 * `locked` avisa que el Select va deshabilitado.
 *
 * Un "hook propio": una función que empieza con `use` y usa otros hooks. Saca la
 * lógica de carga del componente para reutilizarla en varios formularios.
 */
export function useAgencyOptions(currentId) {
  const { user, isAdmin } = useAuth()

  // useQuery pide los datos y los guarda en la caché con esa clave. Si otro
  // formulario ya los pidió hace poco, los devuelve al instante.
  const all = useQuery({
    queryKey: queryKeys.agencies.list(PARAMS),
    queryFn: ({ signal }) => listAgencies(PARAMS, { signal }),
    enabled: isAdmin,
    // `select` transforma la respuesta antes de entregarla: del Page de Spring
    // a la lista { value, label } que espera el Select (value como texto).
    select: (page) => page.content.map(toOption),
  })
  // Misma clave que el detalle: la comparte con Configuración y los listados.
  const own = useQuery({
    queryKey: queryKeys.agencies.detail(user?.agencyId),
    queryFn: ({ signal }) => findAgency(user.agencyId, { signal }),
    enabled: !isAdmin && user?.agencyId != null,
    select: (agency) => [toOption(agency)],
  })
  const query = isAdmin ? all : own

  const loaded = query.data ?? []
  // Un registro cuya agencia ya no está activa igual tiene que mostrar su valor.
  const missing = currentId && !loaded.some((option) => option.value === currentId)
  const options = missing ? [{ value: currentId, label: `Agencia #${currentId}` }, ...loaded] : loaded

  return { ...selectState(query), options, locked: !isAdmin }
}
