import { useEffect, useState } from 'react'
import { Link, NavLink as RouterNavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Button,
  Group,
  Indicator,
  NavLink,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconBell, IconHome, IconLogout, IconPlus, IconSearch } from '@tabler/icons-react'

import { emptyWorkspaceTotals, getWorkspaceTotals } from '../services/workspace.js'
import { DASHBOARD_INDEX, dashboardSections, getActiveNavPath } from './dashboard-nav.js'

const HEADER_HEIGHT = 72
// Formatea números al estilo argentino: 1234 -> "1.234".
const NUMBER_FORMAT = new Intl.NumberFormat('es-AR')

/**
 * Totales reales de los listados paginados. Se piden una sola vez por montaje y
 * se abortan al desmontar; si fallan, cada valor queda en `null`.
 */
function useWorkspaceTotals() {
  // Arranca con los totales en null: el pie del menú muestra "—" hasta que llegan.
  const [totals, setTotals] = useState(emptyWorkspaceTotals)

  // `[]` como dependencias: el efecto corre una sola vez, al montar el panel.
  useEffect(() => {
    const controller = new AbortController()

    getWorkspaceTotals({ signal: controller.signal }).then((result) => {
      // Si el componente ya se desmontó, no se toca el estado.
      if (!controller.signal.aborted) setTotals(result)
    })

    // Limpieza: al desmontar se cancelan los pedidos que sigan en camino.
    return () => controller.abort()
  }, [])

  return totals
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
  const totals = useWorkspaceTotals()

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
            <UnstyledButton component={Link} to={DASHBOARD_INDEX}>
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={36} radius="md" variant="filled">
                  <IconHome size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={700} lh={1.1}>
                    HabitatPro
                  </Text>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={1}>
                    Enterprise Suite
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          </Group>

          {/* Buscador, campana y datos de la agencia: por ahora son estáticos. */}
          <TextInput
            type="search"
            aria-label="Buscar en el panel"
            placeholder="Buscar referencia, dirección o cliente..."
            leftSection={<IconSearch size={16} />}
            radius="md"
            flex={1}
            maw={420}
            visibleFrom="md"
          />

          <Group gap="md" wrap="nowrap">
            <Indicator size={8} offset={6}>
              <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Notificaciones">
                <IconBell size={22} />
              </ActionIcon>
            </Indicator>
            <Button
              component={Link}
              to="/dashboard/propiedades/nueva"
              leftSection={<IconPlus size={16} />}
              visibleFrom="sm"
            >
              Crear propiedad
            </Button>
            <Group gap="xs" wrap="nowrap" visibleFrom="lg">
              <Avatar radius="xl" color="teal">
                HR
              </Avatar>
              <div>
                <Text size="sm" fw={600} lh={1.2}>
                  Habitat Real Estate
                </Text>
                <Text size="xs" c="dimmed">
                  Córdoba HQ
                </Text>
              </div>
            </Group>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component="nav" aria-label="Navegación principal">
          {/* El menú se dibuja recorriendo los datos de dashboard-nav.js: una
              sección por grupo y un NavLink por ítem. */}
          <Stack gap="lg">
            {dashboardSections.map((section) => (
              <div key={section.title}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.5} mb="xs">
                  {section.title}
                </Text>

                {section.items.map((item) => (
                  // `component={RouterNavLink}`: el NavLink de Mantine (el estilo)
                  // se comporta como el link de React Router (cambia de pantalla
                  // sin recargar). `<item.icon />` dibuja el ícono guardado en el dato.
                  <NavLink
                    key={item.to}
                    component={RouterNavLink}
                    to={item.to}
                    label={item.label}
                    active={item.to === activePath}
                    leftSection={<item.icon size={18} stroke={1.6} />}
                    style={{ borderRadius: 'var(--mantine-radius-md)' }}
                  />
                ))}
              </div>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Text size="xs" fw={700} tt="uppercase" lts={0.5} mb="xs">
            Espacio de trabajo
          </Text>
          <Stack gap={4} mb="md">
            {totals.map((stat) => (
              <Group key={stat.key} justify="space-between" wrap="nowrap">
                <Text size="sm" c="dimmed">
                  {stat.label}
                </Text>
                <Text size="sm" fw={600} c={stat.total == null ? 'dimmed' : undefined}>
                  {stat.total == null ? '—' : NUMBER_FORMAT.format(stat.total)}
                </Text>
              </Group>
            ))}
          </Stack>

          <Button
            component={Link}
            to="/login"
            variant="subtle"
            color="gray"
            fullWidth
            justify="flex-start"
            leftSection={<IconLogout size={18} />}
          >
            Salir al portal de acceso
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="var(--mantine-color-gray-0)">
        {/* El "hueco" donde React Router pone la pantalla de la ruta actual. */}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
