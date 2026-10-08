/**
 * API de personas: clientes, interesados y propietarios de cada inmobiliaria.
 *
 * Replica `PeopleRequest` / `PeopleResponse` del backend. Cambiar algo acá
 * exige el cambio equivalente en Java.
 */
import { get, post, put } from './api.js'
import { formatCuit, normalizePhone, onlyDigits } from './agencies.js'

export const PEOPLE_ENDPOINT = '/api/people'

/** Refleja las anotaciones `@Size` del `PeopleRequest`. */
export const PEOPLE_LIMITS = {
  name: { min: 3, max: 100 },
  email: { max: 100 },
  phone: { min: 8, max: 15 },
  address: { min: 5, max: 150 },
  dni: { min: 6, max: 10 },
  cuit: { min: 11, max: 13 },
}

/**
 * El DNI y el CUIT son únicos dentro de cada inmobiliaria. El 409 sale de la
 * restricción de la base con el mensaje genérico ("Some of the values are
 * already registered"), así que no dice cuál de los dos se repitió.
 */
export const PEOPLE_CONFLICT_MESSAGE =
  'El DNI o el CUIT ya están cargados para otra persona de esta inmobiliaria.'

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

/** Valores del formulario -> `PeopleRequest`. Los opcionales vacíos viajan como null. */
export function toPeopleRequest(values) {
  return {
    agencyId: Number(values.agencyId),
    name: cleanText(values.name),
    email: cleanText(values.email).toLowerCase(),
    phone: normalizePhone(values.phone),
    address: cleanText(values.address) || null,
    // El DNI viaja solo con dígitos: "30.123.456" -> "30123456".
    dni: onlyDigits(values.dni) || null,
    // El CUIT, con su formato de guiones (13 caracteres, dentro del 11–13 del backend).
    cuit: onlyDigits(values.cuit) ? formatCuit(values.cuit) : null,
  }
}

/** Inversa de `toPeopleRequest`: el backend omite los null del response. */
export function toPeopleFormValues(person) {
  return {
    agencyId: person.agencyId != null ? String(person.agencyId) : null,
    name: person.name ?? '',
    email: person.email ?? '',
    phone: person.phone ?? '',
    address: person.address ?? '',
    dni: person.dni ?? '',
    cuit: person.cuit ?? '',
  }
}

/**
 * GET /api/people -> `Page<PeopleResponse>`. Solo acepta `page` y `size`: sin
 * orden ni filtro por inmobiliaria, y sin tope de página (5 por defecto).
 */
// No usa `pageQuery` (api.js) porque este endpoint no acepta `sort` ni filtros:
// la dirección se arma a mano. `= {}` permite llamar a listPeople() sin argumentos.
export const listPeople = ({ page = 0, size = 20 } = {}, options) =>
  get(`${PEOPLE_ENDPOINT}?page=${page}&size=${size}`, options)

export const findPerson = (id, options) => get(`${PEOPLE_ENDPOINT}/${id}`, options)

/** POST -> 201. 409 si el DNI o el CUIT ya están en la inmobiliaria. */
export const createPerson = (request, options) => post(PEOPLE_ENDPOINT, request, options)

/** En el PUT el `agencyId` se ignora: una persona no cambia de inmobiliaria. */
export const updatePerson = (id, request, options) => put(`${PEOPLE_ENDPOINT}/${id}`, request, options)
