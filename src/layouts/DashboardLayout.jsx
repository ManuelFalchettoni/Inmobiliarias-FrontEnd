import { NavLink as RouterNavLink, Outlet } from 'react-router-dom'
import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Group,
  Indicator,
  NavLink,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBell,
  IconChartBar,
  IconHome,
  IconLogin,
  IconMap,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUsers,
  IconBuildingSkyscraper,
  IconFileDescription,
} from '@tabler/icons-react'

const navItems = [
  { label: 'Explorador & Mapa', icon: IconMap, to: '/dashboard/explorador' },
  { label: 'Publicar Propiedad', icon: IconPlus, to: '/dashboard/propiedades/nueva' },
  { label: 'Ficha de Propiedad', icon: IconFileDescription, to: '/dashboard/propiedades' },
  { label: 'Clientes & Leads', icon: IconUsers, to: '/dashboard/consultas' },
  { label: 'Analítica & Reportes', icon: IconChartBar, to: '/dashboard/analitica' },
  { label: 'Configuración de Agencia', icon: IconBuildingSkyscraper, to: '/dashboard/agencias/nueva' },
  { label: 'Configuración', icon: IconSettings, to: '/dashboard/configuracion' },
  { label: 'Portal de Acceso', icon: IconLogin, to: '/login' },
]

const workspaceStats = [
  { label: 'Inmuebles activos', value: '48' },
  { label: 'Visitas este mes', value: '1.240' },
  { label: 'Ratio conversión', value: '3.8%', color: 'teal' },
]

export default function DashboardLayout() {
  const [opened, { toggle }] = useDisclosure()

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
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

          <TextInput
            placeholder="Buscar referencia, dirección o cliente..."
            leftSection={<IconSearch size={16} />}
            radius="md"
            w={420}
            visibleFrom="md"
          />

          <Group gap="md" wrap="nowrap">
            <Indicator size={8} offset={4}>
              <IconBell size={22} />
            </Indicator>
            <Button leftSection={<IconPlus size={16} />} visibleFrom="sm">
              Crear Propiedad
            </Button>
            <Group gap="xs" wrap="nowrap" visibleFrom="lg">
              <Avatar radius="xl" color="teal">
                HR
              </Avatar>
              <div>
                <Text size="sm" fw={600} lh={1.2}>
                  Habitat Real Estate Agency
                </Text>
                <Text size="xs" c="dimmed">
                  Madrid HQ
                </Text>
              </div>
            </Group>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" lts={0.5}>
            Navegación principal
          </Text>
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              component={RouterNavLink}
              to={item.to}
              label={item.label}
              leftSection={<item.icon size={18} stroke={1.6} />}
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            />
          ))}
        </AppShell.Section>

        <AppShell.Section>
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} tt="uppercase" lts={0.5}>
              Espacio de trabajo
            </Text>
            <Box w={8} h={8} bg="teal.6" style={{ borderRadius: '50%' }} />
          </Group>
          <Stack gap={4}>
            {workspaceStats.map((stat) => (
              <Group key={stat.label} justify="space-between">
                <Text size="sm" c="dimmed">
                  {stat.label}
                </Text>
                <Text size="sm" fw={600} c={stat.color}>
                  {stat.value}
                </Text>
              </Group>
            ))}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="var(--mantine-color-gray-0)">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
