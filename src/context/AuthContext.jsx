/**
 * Proveedor de sesión. Está montado en `main.jsx`, así cualquier pantalla puede
 * leer el usuario que entró con `useAuth()`.
 *
 * El backend manda el JWT en una cookie HttpOnly que JavaScript no puede leer:
 * lo que se guarda acá es solo el usuario que devolvió el login (`id`, `name`,
 * `email`, `rol`, `agencyId`), para saber de quién es la cuenta sin volver a
 * preguntar. Nunca se guarda la contraseña.
 *
 * - Con "Mantener sesión iniciada" se guarda en `localStorage` (sobrevive a
 *   cerrar el navegador, como la cookie de 24 h del backend).
 * - Sin eso, en `sessionStorage` (se borra al cerrar la pestaña).
 */
import { useCallback, useMemo, useState } from 'react'

import { AuthContext } from './auth-context.js'
import { loginUser, toLoginRequest } from '../services/auth.js'

const SESSION_KEY = 'inmobiliarias.session'

/** Se queda solo con los datos que hacen falta para identificar la cuenta. */
function toSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    rol: user.rol,
    agencyId: user.agencyId ?? null,
  }
}

// El acceso al storage puede fallar (navegación privada, storage bloqueado):
// en ese caso la sesión vive solo en memoria mientras la página esté abierta.
function readSession() {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const raw = storage.getItem(SESSION_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      // Se ignora: se prueba con el otro storage.
    }
  }
  return null
}

function writeSession(user, remember) {
  clearSession()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(user))
  } catch {
    // Sin storage la sesión queda solo en memoria.
  }
}

function clearSession() {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.removeItem(SESSION_KEY)
    } catch {
      // Nada que limpiar.
    }
  }
}

/** ¿La sesión actual está en localStorage? Se usa para no cambiarla de lugar al actualizarla. */
function isRemembered() {
  try {
    return localStorage.getItem(SESSION_KEY) != null
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  // La función dentro de useState se ejecuta una sola vez, al montar.
  const [user, setUser] = useState(readSession)

  /** Llama al backend y, si sale bien, guarda el usuario. Lanza el ApiError si falla. */
  const login = useCallback(async (values, options) => {
    const request = toLoginRequest(values)
    const response = await loginUser(request, options)
    const session = toSessionUser(response)
    writeSession(session, request.remember)
    setUser(session)
    return session
  }, [])

  /**
   * Cierra la sesión del lado del front. El backend todavía no tiene un
   * endpoint de logout, y la cookie HttpOnly no se puede borrar desde
   * JavaScript: vence sola (al cerrar el navegador o a las 24 h).
   */
  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  /**
   * Refresca los datos guardados después de editar la cuenta (por ejemplo, si
   * cambió el nombre o el email), en el mismo storage donde estaban.
   */
  const refreshUser = useCallback((updated) => {
    const session = toSessionUser(updated)
    writeSession(session, isRemembered())
    setUser(session)
  }, [])

  // useMemo: el objeto del contexto cambia solo cuando cambia el usuario, así
  // los componentes que leen la sesión no se redibujan de más.
  const value = useMemo(() => ({ user, login, logout, refreshUser }), [user, login, logout, refreshUser])

  return <AuthContext value={value}>{children}</AuthContext>
}
