import { createContext, use } from 'react'

/**
 * Contexto de sesión. Vive en su propio módulo (sin JSX) para que el archivo del
 * proveedor exporte solo componentes y Fast Refresh siga funcionando.
 */
// Un contexto es una forma de compartir datos con todos los componentes de
// adentro de un "proveedor", sin pasarlos como props nivel por nivel.
export const AuthContext = createContext(null)

/** Hook para leer la sesión. Falla con un mensaje claro si falta el proveedor. */
export function useAuth() {
  // `use` (React 19) lee el valor del contexto más cercano hacia arriba.
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.')
  }
  return context
}
