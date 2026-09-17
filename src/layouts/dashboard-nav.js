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

/**
 * Navegación del panel, ordenada por lo que el backend expone hoy
 * (ManuelFalchettoni/Inmobiliarias-BackEnd).
 *
 * Cada ítem declara el endpoint que va a consumir, o por qué todavía no puede
 * existir. Así el menú no promete pantallas que la API no puede alimentar, y al
 * implementar una sección ya se sabe contra qué se conecta.
 *
 * Recursos disponibles: /api/properties (+ fotos), /api/agencies y /api/users.
 * Los tres son paginados, aceptan `?active=` y tienen borrado lógico con restore.
 */
const sections = [
  {
    title: 'Gestión',
    items: [
      {
        path: 'propiedades',
        label: 'Propiedades',
        icon: IconBuildingEstate,
        endpoint: 'GET /api/properties',
        description:
          'Listado paginado de propiedades, con filtro por agencia y por estado de publicación.',
      },
      {
        path: 'propiedades/nueva',
        label: 'Publicar propiedad',
        icon: IconPlus,
        endpoint: 'POST /api/properties',
        description:
          'Alta de una propiedad con su tipo, condición, ocupación, superficie y fotos.',
      },
      {
        path: 'agencias',
        label: 'Agencias',
        icon: IconBuildingSkyscraper,
        endpoint: 'GET /api/agencies',
        description: 'Agencias registradas en la plataforma y su estado de verificación.',
        action: { to: `${DASHBOARD_ROOT}/agencias/nueva`, label: 'Dar de alta una agencia' },
      },
      {
        path: 'usuarios',
        label: 'Usuarios',
        icon: IconUsers,
        endpoint: 'GET /api/users',
        description: 'Cuentas de la plataforma y su rol: USER, AGENT, AGENCY o ADMIN.',
      },
      {
        path: 'archivados',
        label: 'Archivados',
        icon: IconArchive,
        endpoint: 'GET ...?active=false + PATCH .../restore',
        description:
          'Propiedades, agencias y usuarios dados de baja. El borrado es lógico, así que se pueden restaurar.',
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
        endpoint: 'PATCH /api/users/{id}/password',
        description: 'Datos de la cuenta y cambio de contraseña.',
      },
    ],
  },
  {
    title: 'Sin backend todavía',
    badge: 'Pronto',
    items: [
      {
        path: 'explorador',
        label: 'Explorador & Mapa',
        icon: IconMap,
        description: 'Búsqueda de inmuebles sobre el mapa.',
        blockedBy:
          'La propiedad guarda `address` y `location` como texto libre: no hay coordenadas ni un endpoint de búsqueda geográfica. Haría falta agregar latitud y longitud a la entidad.',
      },
      {
        path: 'consultas',
        label: 'Clientes & Leads',
        icon: IconMessages,
        description: 'Consultas recibidas y seguimiento de cada interesado.',
        blockedBy:
          'No existe una entidad de consultas ni de contactos en el backend. Hoy solo hay propiedades, agencias y usuarios.',
      },
      {
        path: 'analitica',
        label: 'Analítica & Reportes',
        icon: IconChartBar,
        description: 'Visitas, conversión y rendimiento de las publicaciones.',
        blockedBy:
          'No hay endpoints de métricas ni registro de visitas. Lo único agregable hoy es el total de cada listado paginado.',
      },
    ],
  },
]

export const dashboardSections = sections.map((section) => ({
  ...section,
  items: section.items.map((item) => ({
    ...item,
    to: `${DASHBOARD_ROOT}/${item.path}`,
    comingSoon: Boolean(item.blockedBy),
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
