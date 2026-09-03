import { useCallback, useState } from 'react'
import { AuthContext } from './auth-context.js'


const STORAGE_KEY = 'inmobiliarias.demo.users'
const SESSION_KEY = 'inmobiliarias.demo.session'

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

function writeUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
}

/** Simula la latencia de red para que se vea el estado de carga del botón. */
function delay(ms = 600) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY))
    } catch {
      return null
    }
  })

  const login = useCallback(async ({ email, password }) => {
    await delay()
    const found = readUsers().find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    )

    if (!found || found.password !== password) {
      throw new Error('Email o contraseña incorrectos.')
    }

    const session = { name: found.name, email: found.email }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return session
  }, [])

  const register = useCallback(async ({ name, email, password }) => {
    await delay()
    const users = readUsers()
    const normalized = email.trim().toLowerCase()

    if (users.some((u) => u.email.toLowerCase() === normalized)) {
      throw new Error('Ya existe una cuenta con ese email.')
    }

    const created = { name: name.trim(), email: email.trim(), password }
    writeUsers([...users, created])
    return created
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext value={{ user, login, register, logout }}>{children}</AuthContext>
  )
}
