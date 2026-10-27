/**
 * Proveedor de sesión. Está montado en `main.jsx`, así cualquier pantalla puede
 * leer el usuario que entró con `useAuth()`.
 *
 * El backend manda el JWT en una cookie HttpOnly que JavaScript no puede leer:
 * lo que se guarda acá es solo el usuario (`id`, `name`, `email`, `rol`,
 * `agencyId`), en memoria. Al recargar la página se vuelve a preguntar con
 * `GET /api/users/me`: si la cookie sigue vigente responde el usuario, y si no,
 * 401. La cookie es la única fuente de verdad; el front no guarda nada en storage.
 *
 * `status`:
 * - `checking`: todavía no volvió el `/me` del arranque. Las rutas del panel
 *   esperan con un spinner en vez de mandar al login.
 * - `ready`: ya se sabe; `user` es el usuario o `null`.
 *
 * `expired` queda en true cuando un pedido con sesión respondió 401 (la cookie
 * venció o el usuario se dio de baja): el login lo usa para avisar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { AuthContext } from './auth-context.js'
import { setUnauthorizedHandler } from '../services/api.js'
import { loginUser, logoutUser, toLoginRequest } from '../services/auth.js'
import { USER_ROL, findMe } from '../services/users.js'

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

const SIGNED_OUT = { status: 'ready', user: null, expired: false }

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState({ status: 'checking', user: null, expired: false })

  // ¿Hay una cookie vigente? Se pregunta una vez, al abrir la app.
  useEffect(() => {
    const controller = new AbortController()
    findMe({ signal: controller.signal })
      .then((user) => setSession({ status: 'ready', user: toSessionUser(user), expired: false }))
      .catch(() => {
        // 401 (sin sesión) o backend caído: en los dos casos se entra por el login.
        if (!controller.signal.aborted) setSession(SIGNED_OUT)
      })
    return () => controller.abort()
  }, [])

  // Un 401 en cualquier pedido: la sesión venció. Se borra la caché (eran datos
  // de esa cuenta) y el usuario; las rutas del panel mandan al login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear()
      // Solo cuenta como "venció" si había alguien logueado: el 401 del `/me`
      // del arranque es simplemente "no hay sesión".
      setSession((current) => (current.user ? { status: 'ready', user: null, expired: true } : current))
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  /**
   * Llama al backend y, si sale bien, guarda el usuario. Lanza el ApiError si falla.
   * El login trae `id`, `name`, `email` y `rol`; `/me` suma la inmobiliaria, que
   * hace falta en las altas. Si `/me` fallara, se sigue con lo del login.
   */
  const login = useCallback(
    async (values, options) => {
      const loggedIn = await loginUser(toLoginRequest(values), options)
      const user = await findMe(options).catch(() => loggedIn)
      // Lo que haya quedado en caché de otra cuenta no tiene que verlo esta.
      queryClient.clear()
      const current = toSessionUser(user)
      setSession({ status: 'ready', user: current, expired: false })
      return current
    },
    [queryClient],
  )

  /** Pide al backend que borre la cookie y limpia el estado, aunque el pedido falle. */
  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } catch {
      // Sin respuesta la cookie queda hasta que venza; el front se limpia igual.
    }
    queryClient.clear()
    setSession(SIGNED_OUT)
  }, [queryClient])

  /** Refresca los datos de la sesión después de editar la cuenta (nombre o email). */
  const refreshUser = useCallback((updated) => {
    setSession((current) => ({ ...current, user: toSessionUser(updated) }))
  }, [])

  // useMemo: el objeto del contexto cambia solo cuando cambia la sesión, así
  // los componentes que la leen no se redibujan de más.
  const value = useMemo(
    () => ({
      ...session,
      isAdmin: session.user?.rol === USER_ROL.ADMIN,
      login,
      logout,
      refreshUser,
    }),
    [session, login, logout, refreshUser],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
