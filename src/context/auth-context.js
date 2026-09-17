import { createContext, use } from 'react'

/**
 * Contexto de sesión. Vive en su propio módulo (sin JSX) para que el archivo del
 * proveedor exporte solo componentes y Fast Refresh siga funcionando.
 */
export const AuthContext = createContext(null)

export function useAuth() {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.')
  }
  return context
}
