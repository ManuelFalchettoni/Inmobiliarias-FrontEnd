import {
  IconArchive,
  IconBellRinging,
  IconBuildingEstate,
  IconBuildingSkyscraper,
  IconChartBar,
  IconFileText,
  IconMap,
  IconMessages,
  IconSettings,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'

import { PANEL_ROLES, USER_ROL, hasRole } from '../services/users.js'

export const DASHBOARD_ROOT = '/dashboard'
export const SETTINGS_PATH = `${DASHBOARD_ROOT}/configuracion`

/** Todos los roles, USER incluido: solo para la cuenta propia. */
const ALL_ROLES = Object.values(USER_ROL)

/**
 * Secciones e ítems del menú lateral del panel.
 *
 * El menú no está escrito a mano en el JSX: son datos. Cada ítem tiene:
 * - `path`: la ruta relativa a /dashboard.
 * - `label` e `icon`: lo que se ve en el menú (el ícono es el componente, sin dibujar).
 * - `description` y `action`: los usa la pantalla "Próximamente" de las
 *   secciones que todavía no están hechas.
 * - `roles`: quién lo ve. Sin `roles`, los del panel (ADMIN, AGENCY y AGENT).
 * Agregar una sección al menú es agregar un objeto acá.
 */
const sections = [
  {
    title: 'Gestión',
    items: [
      { /* lista de objetos, y el layout la recorre para dibujarlo.  */
        path: 'propiedades',
        label: 'Propiedades',
        icon: IconBuildingEstate,
        description:
          'Listado paginado de propiedades, con filtro por agencia y por estado de publicación.',
      },
      {
        path: 'agencias',
        label: 'Agencias',
        icon: IconBuildingSkyscraper,
        description: 'Agencias registradas en la plataforma y su estado de verificación.',
        action: { to: `${DASHBOARD_ROOT}/agencias/nueva`, label: 'Dar de alta una agencia' },
        // Listar, crear, dar de baja y restaurar inmobiliarias es solo del admin.
        roles: [USER_ROL.ADMIN],
      },
      {
        path: 'usuarios',
        label: 'Usuarios',
        icon: IconUsers,
        description: 'Cuentas de la plataforma y su rol: USER, AGENT, AGENCY o ADMIN.',
        action: { to: `${DASHBOARD_ROOT}/usuarios/nuevo`, label: 'Dar de alta un usuario' },
      },
      {
        path: 'personas',
        label: 'Personas',
        icon: IconUsersGroup,
        description: 'Clientes, interesados y propietarios de cada inmobiliaria.',
        action: { to: `${DASHBOARD_ROOT}/personas/nueva`, label: 'Cargar una persona' },
      },
      {
        path: 'contratos',
        label: 'Contratos',
        icon: IconFileText,
        description: 'Contratos de venta y alquiler, con sus partes.',
        action: { to: `${DASHBOARD_ROOT}/contratos/nuevo`, label: 'Cargar un contrato' },
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
        path: 'avisos',
        label: 'Agenda de avisos',
        icon: IconBellRinging,
        description: 'Leads ordenados por el tiempo que falta para su próximo aviso.',
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
        roles: ALL_ROLES,
      },
    ],
  },
]

// A cada ítem se le agrega `to`, la dirección completa ("/dashboard/propiedades").
// `...section` y `...item` copian el objeto original y se le suman campos, sin
// modificar el de arriba.
export const dashboardSections = sections.map((section) => ({
  ...section,
  items: section.items.map((item) => ({
    ...item,
    roles: item.roles ?? PANEL_ROLES,
    to: `${DASHBOARD_ROOT}/${item.path}`,
  })),
}))

/**
 * Todos los ítems en una sola lista, para generar las rutas. `flatMap` aplana:
 * de [[a, b], [c]] (ítems por sección) pasa a [a, b, c].
 */
export const dashboardNav = dashboardSections.flatMap((section) => section.items)

/** El menú que ve un usuario: sin los ítems de otros roles ni las secciones que quedan vacías. */
export const sectionsFor = (user) =>
  dashboardSections
    .map((section) => ({ ...section, items: section.items.filter((item) => hasRole(user, item.roles)) }))
    .filter((section) => section.items.length > 0)

/** Ruta a la que entra `/dashboard` sin subruta. */
export const DASHBOARD_INDEX = dashboardNav[0].to

/** Inicio de cada uno: un USER solo tiene su cuenta. */
export const homeFor = (user) => (hasRole(user, PANEL_ROLES) ? DASHBOARD_INDEX : SETTINGS_PATH)

/**
 * Devuelve el `to` del ítem que corresponde a la URL actual. Se queda con la
 * coincidencia más larga para que `/dashboard/propiedades/nueva` no marque
 * también a `/dashboard/propiedades`.
 */
export function getActiveNavPath(pathname) {
  let active

  for (const { to } of dashboardNav) {
    // La barra en `${to}/` evita que "/dashboard/propiedades-viejas" cuente como
    // dentro de "/dashboard/propiedades": solo coinciden las subrutas de verdad.
    const matches = pathname === to || pathname.startsWith(`${to}/`)
    // Entre varias coincidencias gana la más larga, que es la más específica.
    if (matches && (!active || to.length > active.length)) active = to
  }

  return active
}
