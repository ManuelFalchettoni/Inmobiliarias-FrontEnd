import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@mantine/hooks'

import { queryKeys } from '../queries/keys.js'
import { selectState } from '../queries/status.js'
import { findPerson, searchPeople } from '../services/people.js'
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

const PEOPLE_RESULTS = 20
const personToOption = (person) => ({ value: String(person.id), label: `${person.name} · ${person.phone}` })

/**
 * Personas: no se traen todas. El Select busca por nombre en el backend
 * (/api/people/search, ordenado por nombre) mientras se escribe, y muestra las
 * primeras 20. La persona ya elegida (`currentId`, por ejemplo la recién
 * creada) se pide aparte si no está entre los resultados.
 *
 * Además de `state` y `options` devuelve `searchProps`, que hay que pasarle
 * al Select (`<Select {...people.searchProps} />`) para que la búsqueda vaya
 * al backend.
 */
export function usePeopleOptions(currentId) {
  const [search, setSearch] = useState('')
  // Se pide 300 ms después de la última tecla, no una vez por letra.
  const [term] = useDebouncedValue(search.trim(), 300)
  // Al elegir una opción, Mantine pone su etiqueta ("Ana · 11 5555") como texto
  // de búsqueda: se busca solo por la parte del nombre, así la elegida sigue
  // apareciendo entre los resultados.
  const name = term.split(' · ')[0]

  const params = { page: 0, size: PEOPLE_RESULTS, name }
  const list = useQuery({
    queryKey: queryKeys.people.list(params),
    queryFn: ({ signal }) => searchPeople(params, { signal }),
    select: (page) => page.content.map(personToOption),
    // Mientras llega la búsqueda nueva se siguen mostrando los resultados anteriores.
    placeholderData: keepPreviousData,
  })

  const loaded = list.data ?? []
  const missing = list.isSuccess && Boolean(currentId) && !loaded.some((o) => o.value === String(currentId))
  const extra = useQuery({
    queryKey: queryKeys.people.detail(currentId),
    queryFn: ({ signal }) => findPerson(currentId, { signal }),
    enabled: missing,
  })

  let options = loaded
  if (missing) {
    const option = extra.data ? personToOption(extra.data) : { value: String(currentId), label: `#${currentId}` }
    options = [option, ...loaded]
  }

  return {
    ...selectState(list),
    options,
    searchProps: {
      searchValue: search,
      onSearchChange: setSearch,
      // El backend ya filtró: sin esto Mantine volvería a filtrar en el
      // navegador con el texto nuevo antes de que lleguen los resultados.
      filter: ({ options: all }) => all,
    },
  }
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
export const useUserOptions = (currentId) => useOptions(USERS, currentId)
