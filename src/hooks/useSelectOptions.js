import { useEffect, useState } from 'react'

import { findPerson, listPeople } from '../services/people.js'
import { findProperty, formatPropertyPlace, listProperties } from '../services/properties.js'
import { USER_ROL_LABEL, findUser, listUsers } from '../services/users.js'

/**
 * Carga una lista para un Select una vez por montaje. Si `currentId` no está
 * en la primera página (por el tope de 100, o porque se acaba de crear) se
 * pide aparte con `findOne` y se suma al principio.
 */
function useOptions({ load, findOne, toOption }, currentId) {
  const [result, setResult] = useState({ state: 'loading', options: [] })
  const [extra, setExtra] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    load({ signal: controller.signal })
      .then((records) => setResult({ state: 'ready', options: records.map(toOption) }))
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ state: 'error', message: error.message, options: [] })
      })

    return () => controller.abort()
    // `load` y `toOption` son constantes de módulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const missing =
    result.state === 'ready' && currentId && !result.options.some((option) => option.value === currentId)

  useEffect(() => {
    if (!missing) return undefined
    const controller = new AbortController()

    findOne(currentId, { signal: controller.signal })
      .then((record) => setExtra(toOption(record)))
      .catch(() => {
        if (!controller.signal.aborted) setExtra({ value: currentId, label: `#${currentId}` })
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, currentId])

  const options = missing && extra?.value === currentId ? [extra, ...result.options] : result.options
  return { ...result, options }
}

const PROPERTIES = {
  load: (options) =>
    listProperties({ size: 100, active: true }, options).then((page) => page.content),
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
  load: (options) => listPeople({ size: 500 }, options).then((page) => page.content),
  findOne: findPerson,
  toOption: (person) => ({ value: String(person.id), label: `${person.name} · ${person.phone}` }),
}

const USERS = {
  load: (options) =>
    listUsers({ size: 100, sort: 'name,asc', active: true }, options).then((page) => page.content),
  findOne: findUser,
  toOption: (user) => ({
    value: String(user.id),
    label: `${user.name} · ${USER_ROL_LABEL[user.rol] ?? user.rol}`,
  }),
}

export const usePropertyOptions = (currentId) => useOptions(PROPERTIES, currentId)
export const usePeopleOptions = (currentId) => useOptions(PEOPLE, currentId)
export const useUserOptions = (currentId) => useOptions(USERS, currentId)
