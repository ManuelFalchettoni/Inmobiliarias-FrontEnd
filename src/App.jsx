import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'

import Login from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'

// El panel se descarga recién cuando se entra a /dashboard.
const DashboardRoutes = lazy(() => import('./pages/dashboard/DashboardRoutes.jsx'))

function RouteFallback() {
  return (
    <Center mih="100vh">
      <Loader />
    </Center>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />

      <Route
        path="/dashboard/*"
        element={
          <Suspense fallback={<RouteFallback />}>
            <DashboardRoutes />
          </Suspense>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
