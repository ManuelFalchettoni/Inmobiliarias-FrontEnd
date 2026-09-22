/**
 * API de usuarios y normalización de datos.
 *
 * Replica `UserRequest`, `UserUpdateRequest`, `UserPasswordRequest`,
 * `UserResponse` y `enums/user/UserRol` del backend. Cambiar algo acá exige el
 * cambio equivalente en Java.
 *
 * Todavía no hay endpoint de login: el backend guarda el hash de BCrypt pero no
 * expone nada para validar credenciales ni emite tokens.
 */
import { del, get, pageQuery, patch, post, put } from './api.js'
import { normalizePhone } from './agencies.js'

export const USERS_ENDPOINT = '/api/users'

/** Refleja `enums/user/UserRol`. */
export const USER_ROL = {
  USER: 'USER',
  AGENT: 'AGENT',
  AGENCY: 'AGENCY',
  ADMIN: 'ADMIN',
}

export const USER_ROL_OPTIONS = [
  { value: USER_ROL.USER, label: 'Usuario' },
  { value: USER_ROL.AGENT, label: 'Agente' },
  { value: USER_ROL.AGENCY, label: 'Agencia' },
  { value: USER_ROL.ADMIN, label: 'Administrador' },
]

export const USER_ROL_LABEL = Object.fromEntries(USER_ROL_OPTIONS.map((o) => [o.value, o.label]))

/** Rol de las cuentas que se crean desde el registro público. */
export const PUBLIC_SIGNUP_ROL = USER_ROL.USER

/** Refleja las anotaciones `@Size` del `UserRequest`. */
export const USER_LIMITS = {
  name: { min: 3, max: 20 },
  email: { max: 100 },
  password: { min: 8, max: 20 },
  phoneNumber: { min: 8, max: 15 },
}

/**
 * Traduce un 409 de `UserCreatorService` al campo que lo causó. Los mensajes
 * son "Email already registered: ..." y "Phone number already registered: ...".
 */
export function userConflictField(message) {
  const normalized = String(message ?? '').toLowerCase()
  if (normalized.startsWith('email')) return 'email'
  if (normalized.startsWith('phone')) return 'phoneNumber'
  return null
}

const cleanName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')
const cleanEmail = (value) => String(value ?? '').trim().toLowerCase()

/** Valores del formulario -> `UserRequest` (exactamente estos 5 campos). */
export function toUserRequest(values) {
  return {
    name: cleanName(values.name),
    email: cleanEmail(values.email),
    password: values.password,
    phoneNumber: normalizePhone(values.phoneNumber),
    rol: values.rol,
  }
}

/** Valores del formulario -> `UserUpdateRequest`: sin contraseña ni rol. */
export function toUserUpdateRequest(values) {
  return {
    name: cleanName(values.name),
    email: cleanEmail(values.email),
    phoneNumber: normalizePhone(values.phoneNumber),
  }
}

/** POST /api/users -> 201 con el `UserResponse` creado. */
export const createUser = (request, options) => post(USERS_ENDPOINT, request, options)

/** GET /api/users -> `Page<UserResponse>`. Filtro: `active`. */
export const listUsers = (params, options) => get(`${USERS_ENDPOINT}?${pageQuery(params)}`, options)

export const findUser = (id, options) => get(`${USERS_ENDPOINT}/${id}`, options)

export const updateUser = (id, request, options) => put(`${USERS_ENDPOINT}/${id}`, request, options)

/** PATCH `{ currentPassword, password }` -> 204. 400 si la actual no coincide. */
export const updateUserPassword = (id, { currentPassword, password }, options) =>
  patch(`${USERS_ENDPOINT}/${id}/password`, { currentPassword, password }, options)

/** Baja lógica: 204 y el usuario queda con `active = false`. */
export const deleteUser = (id, options) => del(`${USERS_ENDPOINT}/${id}`, options)

export const restoreUser = (id, options) => patch(`${USERS_ENDPOINT}/${id}/restore`, undefined, options)
