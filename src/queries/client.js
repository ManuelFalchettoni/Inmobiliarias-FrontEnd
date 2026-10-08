/**
 * Configuración de React Query (TanStack Query).
 *
 * React Query guarda en una caché las respuestas del backend, identificadas por
 * una "query key" (ver keys.js). Se encarga de lo que antes se hacía a mano en
 * cada pantalla: saber si está cargando, cancelar pedidos viejos, no repetir un
 * pedido que ya está en camino y volver a pedir los datos cuando cambian.
 */
import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '../services/api.js'

/**
 * Reintenta solo cuando tiene sentido: sin respuesta del servidor (status 0) o
 * un error 5xx, y una sola vez. Un 400, 404 o 409 no se arregla reintentando,
 * y esperar los reintentos demoraría el mensaje de error.
 */
function shouldRetry(failureCount, error) {
  if (!(error instanceof ApiError)) return false
  const transient = error.isNetworkError || error.status >= 500
  return transient && failureCount < 1
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Durante 30 s un dato se considera "fresco": volver a una pantalla
      // dentro de ese tiempo lo muestra al instante, sin pedirlo de nuevo.
      staleTime: 30 * 1000,
      retry: shouldRetry,
    },
  },
})
