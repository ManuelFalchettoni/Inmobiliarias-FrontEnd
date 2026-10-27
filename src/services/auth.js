/**
 * Login contra el backend.
 *
 * Replica `AuthUserLoginRequest` del backend. `POST /api/auth/login` responde
 * 200 con el `UserResponse` (id, nombre, email, rol, inmobiliaria...) y deja el
 * JWT en la cookie `token` (HttpOnly): el front no lo ve ni lo guarda, el
 * navegador lo reenvía solo gracias a `credentials: 'include'` (ver api.js).
 *
 * Email inexistente, usuario dado de baja y contraseña incorrecta dan el mismo
 * 401 "Invalid email or password".
 */
import { post } from './api.js'

export const LOGIN_ENDPOINT = '/api/auth/login'

/** Valores del formulario -> `AuthUserLoginRequest`: exactamente esos tres campos. */
export function toLoginRequest(values) {
  return {
    email: String(values.email ?? '').trim().toLowerCase(),
    password: values.password,
    // `remember: true` hace que la cookie dure 24 horas; sin él, dura lo que la
    // sesión del navegador.
    remember: Boolean(values.remember),
  }
}

/** POST /api/auth/login -> 200 con `{ id, name, email, rol }` del usuario que entró. */
export const loginUser = (request, options) => post(LOGIN_ENDPOINT, request, options)

/**
 * POST /api/auth/logout, sin body -> 204, haya sesión o no. La cookie es
 * HttpOnly: JavaScript no la puede borrar, la pisa el backend.
 */
export const logoutUser = (options) => post('/api/auth/logout', undefined, options)
