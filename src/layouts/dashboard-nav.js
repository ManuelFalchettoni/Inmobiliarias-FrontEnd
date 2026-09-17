import {
  IconBuildingSkyscraper,
  IconChartBar,
  IconFileDescription,
  IconMap,
  IconPlus,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'

export const DASHBOARD_ROOT = '/dashboard'

/**
 * Única fuente de verdad de la navegación del panel: la usan tanto el menú
 * lateral como las rutas de `App.jsx`, así ningún enlace puede quedar sin
 * pantalla detrás.
 */
const items = [
  {
    path: 'explorador',
    label: 'Explorador & Mapa',
    icon: IconMap,
    description: 'Buscá inmuebles sobre el mapa y filtrá por zona, tipo de propiedad y precio.',
  },
  {
    path: 'propiedades/nueva',
    label: 'Publicar propiedad',
    icon: IconPlus,
    description: 'Cargá una propiedad nueva con sus fotos, superficie y condiciones de venta.',
  },
  {
    path: 'propiedades',
    label: 'Propiedades',
    icon: IconFileDescription,
    description: 'Listado y ficha de las propiedades publicadas por la agencia.',
  },
  {
    path: 'consultas',
    label: 'Clientes & Leads',
    icon: IconUsers,
    description: 'Consultas recibidas y seguimiento de cada interesado.',
  },
  {
    path: 'analitica',
    label: 'Analítica & Reportes',
    icon: IconChartBar,
    description: 'Visitas, conversión y rendimiento de las publicaciones.',
  },
  {
    path: 'agencias',
    label: 'Agencias',
    icon: IconBuildingSkyscraper,
    description: 'Agencias registradas en la plataforma y su estado de verificación.',
    action: { to: `${DASHBOARD_ROOT}/agencias/nueva`, label: 'Dar de alta una agencia' },
  },
  {
    path: 'configuracion',
    label: 'Configuración',
    icon: IconSettings,
    description: 'Preferencias de la cuenta y del espacio de trabajo.',
  },
]

export const dashboardNav = items.map((item) => ({ ...item, to: `${DASHBOARD_ROOT}/${item.path}` }))

/** Ruta a la que entra `/dashboard` sin subruta. */
export const DASHBOARD_INDEX = dashboardNav[0].to

/**
 * Devuelve el `to` del ítem que corresponde a la URL actual. Se queda con la
 * coincidencia más larga para que `/dashboard/propiedades/nueva` no marque
 * también a `/dashboard/propiedades`.
 */
export function getActiveNavPath(pathname) {
  let active

  for (const { to } of dashboardNav) {
    const matches = pathname === to || pathname.startsWith(`${to}/`)
    if (matches && (!active || to.length > active.length)) active = to
  }

  return active
}
