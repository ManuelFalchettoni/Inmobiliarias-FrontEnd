import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'

import { useAuth } from './context/auth-context.js'
import Login from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'

// El panel se descarga recién cuando se entra a /dashboard.
// `lazy` recibe una función que hace un `import()` dinámico: Vite separa ese
// código en un archivo aparte (DashboardRoutes-xxxx.js) que se baja a demanda.
// Quien solo abre el login no descarga tablas, formularios ni fotos.
const DashboardRoutes = lazy(() => import('./pages/dashboard/DashboardRoutes.jsx'))
// La ficha para mostrarle a un cliente: fuera del panel, sin menú ni edición.
const PropertySheet = lazy(() => import('./pages/dashboard/property/PropertySheet.jsx'))

/** Lo que se ve mientras se descarga el panel: un spinner centrado en la pantalla. */
function RouteFallback() {
  return (
    <Center mih="100vh">
      <Loader />
    </Center>
  )
}

/**
 * Toda la API pide login: sin sesión, el panel manda al login y guarda en
 * `state.from` adónde quería ir, para volver ahí después de entrar. Mientras
 * llega el `/me` del arranque se muestra el spinner, no el login.
 */
function RequireAuth({ children }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <RouteFallback />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return children
}

/**
 * Rutas principales. `<Routes>` mira la dirección actual y dibuja la primera
 * `<Route>` cuyo `path` coincide.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />

      {/* El `*` significa "esta ruta y todo lo que cuelgue de ella": las
          subrutas (/dashboard/propiedades, etc.) se resuelven en DashboardRoutes.
          Suspense muestra el fallback mientras llega el código cargado con lazy. */}
      <Route
        path="/dashboard/*"
        element={
          <RequireAuth>
            <Suspense fallback={<RouteFallback />}> {/* Circuito de carga */}
              <DashboardRoutes />
            </Suspense>
          </RequireAuth>
        }
      />

      <Route
        path="/propiedades/:id"
        element={
          <RequireAuth>
            <Suspense fallback={<RouteFallback />}>
              <PropertySheet />
            </Suspense>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} /> {/*Cualquier dirección que no existe redirige al login */}
    </Routes>
  )
}
