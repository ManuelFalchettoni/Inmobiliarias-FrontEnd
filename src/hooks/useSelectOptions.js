import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../queries/keys.js'
import { selectState } from '../queries/status.js'
import { findPerson, listPeople } from '../services/people.js'
import { findProperty, formatPropertyPlace, listProperties } from '../services/properties.js'
import { USER_ROL_LABEL, findUser, listUsers } from '../services/users.js'

/**
 * Carga una lista para un Select. Si `currentId` no está en ella (por el tope
 * de 100, o porque se acaba de crear) se pide aparte con `findOne` y se suma
 * al principio, para que el Select no muestre un id suelto.
 *
 * Un solo hook genérico; lo que cambia entre propiedades, personas y usuarios
 * llega en el primer parámetro.
 */
function useOptions({ resource, params, load, findOne, toOption }, currentId) {
  const list = useQuery({
    queryKey: queryKeys[resource].list(params),
    queryFn: ({ signal }) => load(params, { signal }),
    // Del Page de Spring a la lista de opciones del Select.
    select: (page) => page.content.map(toOption),
  })

  const loaded = list.data ?? []
  // `some` devuelve true si al menos una opción cumple: ¿está el valor elegido?
  const missing = list.isSuccess && Boolean(currentId) && !loaded.some((o) => o.value === currentId)

  // Segunda consulta, solo si falta el valor elegido (`enabled`). Usa la clave
  // de detalle, así comparte caché con el resto de la app.
  const extra = useQuery({
    queryKey: queryKeys[resource].detail(currentId),
    queryFn: ({ signal }) => findOne(currentId, { signal }),
    enabled: missing,
  })

  let options = loaded
  if (missing) {
    // Si el registro no existe se muestra "#id" para que el Select no quede vacío.
    const option = extra.data ? toOption(extra.data) : { value: currentId, label: `#${currentId}` }
    options = [option, ...loaded]
  }

  return { ...selectState(list), options }
}

const PROPERTIES = {
  resource: 'properties',
  params: { size: 100, active: true },
  load: listProperties,
  findOne: findProperty,
  toOption: (property) => ({
    value: String(property.id),
    label: `${property.address} · ${formatPropertyPlace(property)}`,
  }),
}

/**
 * Personas: el listado no tiene orden ni tope, y las más nuevas quedan al final.
 * Por eso se pide una página grande y la recién creada se busca aparte.
 */
const PEOPLE = {
  resource: 'people',
  params: { size: 500 },
  load: listPeople,
  findOne: findPerson,
  toOption: (person) => ({ value: String(person.id), label: `${person.name} · ${person.phone}` }),
}

const USERS = {
  resource: 'users',
  params: { size: 100, sort: 'name,asc', active: true },
  load: listUsers,
  findOne: findUser,
  toOption: (user) => ({
    value: String(user.id),
    label: `${user.name} · ${USER_ROL_LABEL[user.rol] ?? user.rol}`,
  }),
}

export const usePropertyOptions = (currentId) => useOptions(PROPERTIES, currentId)
export const usePeopleOptions = (currentId) => useOptions(PEOPLE, currentId)
export const useUserOptions = (currentId) => useOptions(USERS, currentId)
