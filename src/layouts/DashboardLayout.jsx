import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppShell, Avatar, Burger, Group, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../context/auth-context.js'
import { queryKeys } from '../queries/keys.js'
import { findAgency } from '../services/agencies.js'
import { PANEL_ROLES, USER_ROL_COLOR, USER_ROL_LABEL, findMe, hasRole } from '../services/users.js'
import AgencyLogo from '../components/AgencyLogo.jsx'
import Wordmark from '../components/Wordmark.jsx'
import AlertBell from './AlertBell.jsx'
import DashboardNavbar from './DashboardNavbar.jsx'
import HeaderSearch from './HeaderSearch.jsx'
import { SETTINGS_PATH, getActiveNavPath, homeFor } from './dashboard-nav.js'

const HEADER_HEIGHT = 72

/**
 * La inmobiliaria del usuario logueado, en el encabezado: su logo (o las
 * iniciales si no tiene) y su nombre. El admin no es de ninguna: no se muestra.
 *
 * El logo sale de `agencyIconUrl` (`GET /api/users/me`) y el nombre, del
 * detalle de la agencia. Las dos consultas usan las mismas claves que
 * Configuración y la edición de la agencia, así comparten la caché: al subir o
 * quitar el logo, esa pantalla invalida `users.me()` y las agencias, y este
 * encabezado se redibuja solo, sin recargar la página.
 */
function AgencyBadge({ agencyId }) {
  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: ({ signal }) => findMe({ signal }),
  })
  const { data: agency } = useQuery({
    queryKey: queryKeys.agencies.detail(agencyId),
    queryFn: ({ signal }) => findAgency(agencyId, { signal }),
  })

  // Mientras llega el nombre, el texto queda vacío y el cuadrado muestra "?".
  const name = agency?.publicName ?? ''

  return (
    <Group gap="xs" wrap="nowrap" visibleFrom="sm">
      <AgencyLogo src={me?.agencyIconUrl} name={name} size={36} />
      <Text size="sm" fw={600} lh={1.2} maw={160} truncate="end">
        {name}
      </Text>
    </Group>
  )
}

/**
 * El marco de todas las pantallas del panel: barra superior, menú lateral y,
 * en el medio, la pantalla de la ruta actual (`<Outlet />`).
 */
export default function DashboardLayout() {
  // useDisclosure es un atajo de Mantine para un verdadero/falso con funciones
  // para abrir, cerrar y alternar. Acá controla el menú en celular.
  const [opened, { toggle, close }] = useDisclosure(false)
  // `pathname` es la dirección actual, por ejemplo "/dashboard/propiedades".
  const { pathname } = useLocation()
  // RequireAuth (App.jsx) no deja llegar acá sin sesión: `user` siempre está.
  const { user, logout } = useAuth()
  // Un USER solo tiene su cuenta: sin buscador ni avisos.
  const inPanel = hasRole(user, PANEL_ROLES)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // En móvil el menú se superpone al contenido: al navegar hay que cerrarlo.
  useEffect(() => {
    close()
  }, [pathname, close])

  // Qué ítem del menú se pinta como activo (ver getActiveNavPath).
  const activePath = getActiveNavPath(pathname)

  return (
    // AppShell (Mantine) arma la estructura de la pantalla. En pantallas más
    // chicas que `sm` el menú lateral se esconde (`collapsed.mobile`) y aparece
    // el botón de hamburguesa para abrirlo.
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap" gap="md">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={opened ? 'Cerrar el menú' : 'Abrir el menú'}
            />
            <UnstyledButton component={Link} to={homeFor(user)}>
              <Wordmark size={32} />
            </UnstyledButton>
          </Group>

          {/* Buscador y campana de avisos: un USER recibiría 403, no los ve. */}
          {inPanel && <HeaderSearch flex={1} maw={420} visibleFrom="md" />}

          <Group gap="md" wrap="nowrap">
            {/* USER y ADMIN no tienen inmobiliaria propia: solo AGENCY y AGENT la ven. */}
            {user.agencyId != null && <AgencyBadge agencyId={user.agencyId} />}
            {inPanel && <AlertBell />}
            {/* El usuario que entró: lleva a Configuración. */}
            <UnstyledButton component={Link} to={SETTINGS_PATH} visibleFrom="lg" aria-label="Ir a la configuración de la cuenta">
              <Group gap="xs" wrap="nowrap">
                <Avatar radius="xl" color={USER_ROL_COLOR[user.rol] ?? 'pine'} name={user.name} />
                <div>
                  <Text size="sm" fw={600} lh={1.2}>
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {USER_ROL_LABEL[user.rol] ?? user.rol}
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Menú lateral: secciones, cifras activas y la cuenta (DashboardNavbar.jsx). */}
      <DashboardNavbar user={user} activePath={activePath} onLogout={handleLogout} />

      <AppShell.Main bg="var(--app-paper)">
        {/* El "hueco" donde React Router pone la pantalla de la ruta actual. */}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
