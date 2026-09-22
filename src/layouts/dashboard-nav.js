import {
  IconArchive,
  IconBuildingEstate,
  IconBuildingSkyscraper,
  IconChartBar,
  IconMap,
  IconMessages,
  IconPlus,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'

export const DASHBOARD_ROOT = '/dashboard'

/** Secciones e ítems del menú lateral del panel. */
const sections = [
  {
    title: 'Gestión',
    items: [
      {
        path: 'propiedades',
        label: 'Propiedades',
        icon: IconBuildingEstate,
        description:
          'Listado paginado de propiedades, con filtro por agencia y por estado de publicación.',
      },
      {
        path: 'propiedades/nueva',
        label: 'Publicar propiedad',
        icon: IconPlus,
        description:
          'Alta de una propiedad con su tipo, condición, ocupación, superficie y fotos.',
      },
      {
        path: 'agencias',
        label: 'Agencias',
        icon: IconBuildingSkyscraper,
        description: 'Agencias registradas en la plataforma y su estado de verificación.',
        action: { to: `${DASHBOARD_ROOT}/agencias/nueva`, label: 'Dar de alta una agencia' },
      },
      {
        path: 'usuarios',
        label: 'Usuarios',
        icon: IconUsers,
        description: 'Cuentas de la plataforma y su rol: USER, AGENT, AGENCY o ADMIN.',
        action: { to: `${DASHBOARD_ROOT}/usuarios/nuevo`, label: 'Dar de alta un usuario' },
      },
      {
        path: 'archivados',
        label: 'Archivados',
        icon: IconArchive,
        description: 'Propiedades, agencias y usuarios dados de baja, listos para restaurar.',
      },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      {
        path: 'explorador',
        label: 'Explorador & Mapa',
        icon: IconMap,
        description: 'Búsqueda de inmuebles sobre el mapa.',
      },
      {
        path: 'consultas',
        label: 'Clientes & Leads',
        icon: IconMessages,
        description: 'Consultas recibidas y seguimiento de cada interesado.',
      },
      {
        path: 'analitica',
        label: 'Analítica & Reportes',
        icon: IconChartBar,
        description: 'Visitas, conversión y rendimiento de las publicaciones.',
      },
    ],
  },
  {
    title: 'Cuenta',
    items: [
      {
        path: 'configuracion',
        label: 'Configuración',
        icon: IconSettings,
        description: 'Datos de la cuenta y cambio de contraseña.',
      },
    ],
  },
]

export const dashboardSections = sections.map((section) => ({
  ...section,
  items: section.items.map((item) => ({
    ...item,
    to: `${DASHBOARD_ROOT}/${item.path}`,
  })),
}))

/** Todos los ítems en una sola lista, para generar las rutas. */
export const dashboardNav = dashboardSections.flatMap((section) => section.items)

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
