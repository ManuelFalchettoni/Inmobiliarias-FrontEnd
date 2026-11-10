import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../queries/keys.js'
import { listAllOwners } from '../services/owners.js'
import { findPerson } from '../services/people.js'
import { useLookup } from './useLookup.js'

/** La lista entera de vínculos dueño-propiedad (el backend no filtra por propiedad). */
export const propertyOwnersQuery = {
  queryKey: queryKeys.propertyOwners.all,
  queryFn: ({ signal }) => listAllOwners({ signal }),
}

/** De la lista entera, los dueños de una propiedad. */
export const ownersOfProperty = (owners, propertyId) =>
  owners.filter((owner) => owner.propertyId === Number(propertyId))

/**
 * Los dueños de una propiedad, con su persona. Son los únicos que pueden ser
 * Propietario en un contrato (el backend responde 400 con cualquier otra persona).
 * Mismo pedido que la edición de la propiedad (PropertyOwners).
 */
export function usePropertyOwners(propertyId) {
  const query = useQuery({
    ...propertyOwnersQuery,
    enabled: propertyId != null && propertyId !== '',
    select: (owners) => ownersOfProperty(owners, propertyId),
  })
  const owners = query.data ?? []
  const people = useLookup('people', owners.map((o) => o.peopleId), findPerson)

  const options = owners.map((owner) => {
    const person = people[owner.peopleId]
    const label = person ? `${person.name} · ${person.phone}` : `Persona #${owner.peopleId}`
    return { value: String(owner.peopleId), label }
  })

  return {
    loaded: query.isSuccess,
    error: query.isError ? query.error.message : null,
    owners,
    options,
  }
}
