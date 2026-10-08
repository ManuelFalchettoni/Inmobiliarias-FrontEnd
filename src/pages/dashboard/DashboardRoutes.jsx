import { Navigate, Route, Routes } from 'react-router-dom'

import DashboardLayout from '../../layouts/DashboardLayout.jsx'
import { DASHBOARD_INDEX, dashboardNav } from '../../layouts/dashboard-nav.js'
import AgencyForm from './agency/AgencyForm.jsx'
import AgencyList from './agency/AgencyList.jsx'
import LeadDetail from './crm/LeadDetail.jsx'
import LeadForm from './crm/LeadForm.jsx'
import LeadList from './crm/LeadList.jsx'
import PeopleForm from './people/PeopleForm.jsx'
import PeopleList from './people/PeopleList.jsx'
import PropertyForm from './property/PropertyForm.jsx'
import PropertyList from './property/PropertyList.jsx'
import UserEdit from './user/UserEdit.jsx'
import UserForm from './user/UserForm.jsx'
import UserList from './user/UserList.jsx'
import PagePlaceholder from './PagePlaceholder.jsx'

/** Rutas ya implementadas: quedan fuera del mapeo a PagePlaceholder. */
const IMPLEMENTADAS = new Set([
  'propiedades',
  'propiedades/nueva',
  'agencias',
  'agencias/nueva',
  'usuarios',
  'personas',
  'consultas',
])

/**
 * Rutas del panel, en su propio módulo para que `App.jsx` pueda cargarlas con
 * `lazy`: quien entra al login no descarga el dashboard ni sus dependencias.
 */
export default function DashboardRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to={DASHBOARD_INDEX} replace />} />

        {/* Pantallas conectadas al backend. */}
        <Route path="propiedades" element={<PropertyList />} />
        <Route path="propiedades/nueva" element={<PropertyForm />} />
        <Route path="propiedades/:id/editar" element={<PropertyForm />} />
        <Route path="agencias" element={<AgencyList />} />
        <Route path="agencias/nueva" element={<AgencyForm />} />
        <Route path="usuarios" element={<UserList />} />
        <Route path="usuarios/nuevo" element={<UserForm />} />
        <Route path="usuarios/:id/editar" element={<UserEdit />} />
        <Route path="personas" element={<PeopleList />} />
        <Route path="personas/nueva" element={<PeopleForm />} />
        <Route path="personas/:id/editar" element={<PeopleForm />} />
        <Route path="consultas" element={<LeadList />} />
        <Route path="consultas/nuevo" element={<LeadForm />} />
        <Route path="consultas/:id" element={<LeadDetail />} />

        {/* Secciones del menú que todavía no están disponibles. */}
        {dashboardNav
          .filter((item) => !IMPLEMENTADAS.has(item.path))
          .map((item) => (
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
              action={{ to: DASHBOARD_INDEX, label: 'Volver a propiedades' }}
            />
          }
        />
      </Route>
    </Routes>
  )
}
