/**
 * API de dueños de propiedades: qué personas son dueñas de qué propiedad.
 *
 * Replica `PropertyOwnerRequest` / `PropertyOwnerResponse` del backend.
 */
import { del, get, post, put } from './api.js'

export const OWNERS_ENDPOINT = '/api/property_owners'

/** Valores del formulario -> `PropertyOwnerRequest`. Los tres campos son obligatorios. */
export const toOwnerRequest = (propertyId, values) => ({
  propertyId: Number(propertyId),
  peopleId: Number(values.peopleId),
  comments: String(values.comments ?? '').trim(),
})

/** Un vínculo del response -> request, para el `PUT`. */
export const ownerToRequest = (owner, changes = {}) => ({
  propertyId: owner.propertyId,
  peopleId: owner.peopleId,
  comments: owner.comments ?? '',
  ...changes,
})

const ALL_PAGE_SIZE = 500

/**
 * Todos los vínculos. El backend no filtra por propiedad (solo `page` y
 * `size`), así que se recorren las páginas y se filtra del lado del cliente.
 */
export async function listAllOwners(options) {
  const owners = []
  for (let page = 0; ; page += 1) {
    const result = await get(`${OWNERS_ENDPOINT}?page=${page}&size=${ALL_PAGE_SIZE}`, options)
    owners.push(...result.content)
    if (result.last || result.content.length === 0) return owners
  }
}

export const listPropertyOwners = async (propertyId, options) =>
  (await listAllOwners(options)).filter((owner) => owner.propertyId === Number(propertyId))

/** POST -> 201. 404 si la propiedad o la persona no existen; 409 si la persona ya es dueña. */
export const createOwner = (request, options) => post(OWNERS_ENDPOINT, request, options)

export const updateOwner = (id, request, options) => put(`${OWNERS_ENDPOINT}/${id}`, request, options)

/** Borrado físico: 204. */
export const deleteOwner = (id, options) => del(`${OWNERS_ENDPOINT}/${id}`, options)
