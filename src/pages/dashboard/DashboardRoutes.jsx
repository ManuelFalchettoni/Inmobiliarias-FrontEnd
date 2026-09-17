import { Navigate, Route, Routes } from 'react-router-dom'

import DashboardLayout from '../../layouts/DashboardLayout.jsx'
import { DASHBOARD_INDEX, dashboardNav } from '../../layouts/dashboard-nav.js'
import AgencyForm from './agency/AgencyForm.jsx'
import PagePlaceholder from './PagePlaceholder.jsx'

/**
 * Rutas del panel, en su propio módulo para que `App.jsx` pueda cargarlas con
 * `lazy`: quien entra al login no descarga el dashboard ni sus dependencias.
 */
export default function DashboardRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to={DASHBOARD_INDEX} replace />} />

        {/* Única pantalla del panel conectada al backend. */}
        <Route path="agencias/nueva" element={<AgencyForm />} />

        {/* El resto del menú todavía no tiene implementación, pero sí una pantalla. */}
        {dashboardNav.map((item) => (
          <Route
            key={item.to}
            path={item.path}
            element={
              <PagePlaceholder
                icon={item.icon}
                title={item.label}
                description={item.description}
                action={item.action}
              />
            }
          />
        ))}

        <Route
          path="*"
          element={
            <PagePlaceholder
              title="Página no encontrada"
              description="La sección que buscabas no existe o cambió de dirección."
              action={{ to: DASHBOARD_INDEX, label: 'Volver al explorador' }}
            />
          }
        />
      </Route>
    </Routes>
  )
}
