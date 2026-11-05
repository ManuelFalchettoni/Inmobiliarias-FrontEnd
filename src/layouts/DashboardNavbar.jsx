import { Link, NavLink as RouterNavLink } from 'react-router-dom'
import { ActionIcon, AppShell, Avatar, ScrollArea, Tooltip } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useQueries } from '@tanstack/react-query'

import { queryKeys } from '../queries/keys.js'
import { USER_ROL_COLOR, USER_ROL_LABEL, hasRole } from '../services/users.js'
import { WORKSPACE_TOTALS, fetchWorkspaceTotal } from '../services/workspace.js'
import { DASHBOARD_ROOT, SETTINGS_PATH, sectionsFor } from './dashboard-nav.js'
import classes from './DashboardNavbar.module.css'

// Formatea números al estilo argentino: 1234 -> "1.234".
const NUMBER_FORMAT = new Intl.NumberFormat('es-AR')

/**
 * Totales reales de los listados paginados: una consulta por total.
 *
 * Cada una usa la clave [recurso, 'total']. Como está debajo de la clave del
 * recurso, cuando una pantalla invalida ['properties'] (por ejemplo, al
 * publicar una propiedad), el total del menú se actualiza solo.
 * Si una falla, ese total queda en `null` y se muestra un guion. Solo se piden
 * los que el rol puede ver: un USER no ve ninguno.
 */
function useWorkspaceTotals(user) {
  const entries = WORKSPACE_TOTALS.filter((entry) => hasRole(user, entry.roles))
  const results = useQueries({
    queries: entries.map((entry) => ({
      queryKey: queryKeys[entry.resource].total(),
      queryFn: ({ signal }) => fetchWorkspaceTotal(entry.endpoint, { signal }),
    })),
  })

  return entries.map((entry, index) => {
    const total = results[index].data
    return { ...entry, total: Number.isFinite(total) ? total : null }
  })
}

/** Las cifras activas del espacio de trabajo: una fila por total, que lleva a su listado. */
function WorkspaceTotals({ totals }) {
  return (
    <section aria-labelledby="nav-totals-title">
      <h2 id="nav-totals-title" className={classes.sectionTitle}>
        Activos
      </h2>
      <ul className={classes.totals}>
        {totals.map((stat) => (
          <li key={stat.key}>
            <Link to={`${DASHBOARD_ROOT}/${stat.path}`} className={classes.total}>
              {stat.label}
              <span className={classes.totalValue} data-empty={stat.total == null || undefined}>
                {stat.total == null ? '—' : NUMBER_FORMAT.format(stat.total)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * El menú lateral del panel: las secciones de dashboard-nav.js, las cifras del
 * espacio de trabajo y, al pie, quién entró con el botón para salir.
 *
 * `activePath` es el `to` del ítem que corresponde a la URL (ver
 * getActiveNavPath): React Router marcaría también los padres por prefijo.
 */
export default function DashboardNavbar({ user, activePath, onLogout }) {
  const sections = sectionsFor(user)
  const totals = useWorkspaceTotals(user)
  const roleLabel = USER_ROL_LABEL[user.rol] ?? user.rol

  return (
    <AppShell.Navbar p="md" className={classes.navbar}>
      <AppShell.Section grow component={ScrollArea} className={classes.scroll} scrollbarSize={6}>
        <nav aria-label="Navegación principal" className={classes.sections}>
          {sections.map((section) => (
            <section key={section.title} aria-label={section.title}>
              <h2 className={classes.sectionTitle}>{section.title}</h2>
              <ul className={classes.list}>
                {section.items.map((item) => {
                  const active = item.to === activePath
                  return (
                    <li key={item.to}>
                      {/* `end`: React Router pone `aria-current` solo en la ruta exacta. */}
                      <RouterNavLink
                        to={item.to}
                        end
                        className={classes.item}
                        data-active={active || undefined}
                      >
                        <span className={classes.icon} aria-hidden>
                          <item.icon size={18} stroke={active ? 1.9 : 1.6} />
                        </span>
                        {item.label}
                      </RouterNavLink>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </nav>
      </AppShell.Section>

      <AppShell.Section className={classes.footer}>
        {totals.length > 0 && <WorkspaceTotals totals={totals} />}

        <div className={classes.account}>
          <Link to={SETTINGS_PATH} className={classes.profile} aria-label={`${user.name}, ${roleLabel}. Ir a la configuración de la cuenta`}>
            <Avatar name={user.name} size={34} radius="xl" color={USER_ROL_COLOR[user.rol] ?? 'pine'} className={classes.avatar} />
            <div style={{ minWidth: 0 }}>
              <div className={classes.name}>{user.name}</div>
              <div className={classes.role}>{roleLabel}</div>
            </div>
          </Link>

          <Tooltip label="Cerrar sesión" position="top">
            <ActionIcon variant="subtle" size="lg" className={classes.logout} onClick={onLogout} aria-label="Cerrar sesión">
              <IconLogout size={18} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </div>
      </AppShell.Section>
    </AppShell.Navbar>
  )
}
