/**
 * API de usuarios y normalización de datos.
 *
 * Replica `UserRequest`, `UserUpdateRequest`, `UserPasswordRequest`,
 * `RegisterRequest`, `UserResponse` y `enums/user/UserRol` del backend. Cambiar algo acá exige el
 * cambio equivalente en Java.
 *
 * Todavía no hay endpoint de login: el backend guarda el hash de BCrypt pero no
 * expone nada para validar credenciales ni emite tokens.
 */
import { del, get, pageQuery, patch, post, put } from './api.js'
import { formatCuit, normalizePhone, onlyDigits } from './agencies.js'

export const USERS_ENDPOINT = '/api/users'
export const REGISTER_ENDPOINT = '/api/auth/register'

/** Refleja `enums/user/UserRol`. */
export const USER_ROL = {
  USER: 'USER',
  AGENT: 'AGENT',
  AGENCY: 'AGENCY',
  ADMIN: 'ADMIN',
}

// Los enums se exponen como lista `{ value, label }`: es el formato que espera
// el `data` de un Select de Mantine. `value` es el código que entiende el
// backend; `label`, lo que lee el usuario.
export const USER_ROL_OPTIONS = [
  { value: USER_ROL.USER, label: 'Usuario' },
  { value: USER_ROL.AGENT, label: 'Agente' },
  { value: USER_ROL.AGENCY, label: 'Agencia' },
  { value: USER_ROL.ADMIN, label: 'Administrador' },
]

// El mismo dato como diccionario { AGENT: 'Agente', ... }, para traducir rápido
// al pintar una tabla. Se deriva de la lista para que nunca queden desfasados:
// `map` arma pares [clave, valor] y `Object.fromEntries` los vuelve objeto.
export const USER_ROL_LABEL = Object.fromEntries(USER_ROL_OPTIONS.map((o) => [o.value, o.label]))

export const USER_ROL_COLOR = {
  [USER_ROL.USER]: 'gray',
  [USER_ROL.AGENT]: 'blue',
  [USER_ROL.AGENCY]: 'grape',
  [USER_ROL.ADMIN]: 'red',
}

/** Rol que el backend asigna a las cuentas del registro público. */
export const PUBLIC_SIGNUP_ROL = USER_ROL.USER

/** Refleja las anotaciones `@Size` del `UserRequest`. */
export const USER_LIMITS = {
  name: { min: 3, max: 20 },
  email: { max: 100 },
  password: { min: 8, max: 20 },
  phoneNumber: { min: 8, max: 15 },
  cuit: { min: 11, max: 13 },
  license: { max: 20 },
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

// `trim` saca los espacios de los extremos y el `replace` junta los espacios
// repetidos del medio: "  Juan   Pérez " -> "Juan Pérez".
const cleanName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')
// El email se guarda en minúsculas para que "Juan@Mail.com" y "juan@mail.com"
// cuenten como el mismo (el backend controla que no se repita).
const cleanEmail = (value) => String(value ?? '').trim().toLowerCase()

/** CUIT y matrícula son opcionales: sin valor viajan como null en lugar de "". */
const optionalCuit = (value) => (onlyDigits(value) ? formatCuit(value) : null)
// `||` devuelve el de la derecha si el de la izquierda es "falso" (un texto vacío lo es).
const optionalText = (value) => cleanName(value) || null

/**
 * Valores del formulario -> `UserRequest`. Se arma un objeto nuevo con
 * EXACTAMENTE los campos del DTO: si se mandara el formulario tal cual (con
 * `confirmPassword`, por ejemplo), el backend respondería 400 por campo desconocido.
 */
export function toUserRequest(values) {
  return {
    name: cleanName(values.name),
    email: cleanEmail(values.email),
    password: values.password,
    phoneNumber: normalizePhone(values.phoneNumber),
    rol: values.rol,
    // El Select de Mantine entrega strings; el backend espera un Long.
    agencyId: Number(values.agencyId),
    cuit: optionalCuit(values.cuit),
    license: optionalText(values.license),
  }
}

/** Valores del formulario -> `UserUpdateRequest`: sin contraseña, rol ni agencia. */
export function toUserUpdateRequest(values) {
  return {
    name: cleanName(values.name),
    email: cleanEmail(values.email),
    phoneNumber: normalizePhone(values.phoneNumber),
    cuit: optionalCuit(values.cuit),
    license: optionalText(values.license),
  }
}

/**
 * Valores del formulario -> `RegisterRequest`. Sin rol ni agencia: el backend
 * crea la cuenta como USER y sin inmobiliaria.
 */
export function toRegisterRequest(values) {
  return {
    name: cleanName(values.name),
    email: cleanEmail(values.email),
    password: values.password,
    phoneNumber: normalizePhone(values.phoneNumber),
  }
}

/** POST /api/auth/register -> 201 con el `UserResponse` creado. */
export const registerUser = (request, options) => post(REGISTER_ENDPOINT, request, options)

/** POST /api/users -> 201 con el `UserResponse` creado. */
export const createUser = (request, options) => post(USERS_ENDPOINT, request, options)

/** GET /api/users -> `Page<UserResponse>`. Filtros: `active` y `agencyId`. */
export const listUsers = (params, options) => get(`${USERS_ENDPOINT}?${pageQuery(params)}`, options)

export const findUser = (id, options) => get(`${USERS_ENDPOINT}/${id}`, options)

export const updateUser = (id, request, options) => put(`${USERS_ENDPOINT}/${id}`, request, options)

/**
 * PATCH `{ currentPassword, password }` -> 204. 400 si la actual no coincide.
 * La desestructuración en los parámetros toma solo esos dos campos del objeto
 * recibido: aunque llegue `confirmPassword`, no viaja.
 */
export const updateUserPassword = (id, { currentPassword, password }, options) =>
  patch(`${USERS_ENDPOINT}/${id}/password`, { currentPassword, password }, options)

/** Baja lógica: 204 y el usuario queda con `active = false`. */
export const deleteUser = (id, options) => del(`${USERS_ENDPOINT}/${id}`, options)

export const restoreUser = (id, options) => patch(`${USERS_ENDPOINT}/${id}/restore`, undefined, options)
