/**
 * Páginas "no encontrado" (404).
 *
 * - `NotFound`: el contenido, para usar dentro del panel (una dirección del
 *   panel que no existe, o un registro que el backend respondió con 404).
 * - `NotFoundPage`: la misma pantalla a pantalla completa, para las
 *   direcciones que no existen fuera del panel (`/cualquier-cosa`).
 */
import { Link, useLocation } from 'react-router-dom'
import { Box, Button, Center, Code, Group, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconArrowLeft, IconHome, IconHomeQuestion, IconLogin } from '@tabler/icons-react'

import { useAuth } from '../context/auth-context.js'
import { homeFor } from '../layouts/dashboard-nav.js'

/**
 * El "404" grande con el ícono. `aria-hidden`: es decoración, el título de
 * abajo ya dice lo mismo para los lectores de pantalla.
 */
function Hero() {
  return (
    <Box pos="relative" aria-hidden>
      <Text
        fw={900}
        lh={1}
        ta="center"
        c="var(--mantine-primary-color-light)"
        style={{ fontSize: 'clamp(96px, 22vw, 168px)', letterSpacing: '-0.04em', userSelect: 'none' }}
      >
        404
      </Text>
      <ThemeIcon
        size={72}
        radius="xl"
        variant="filled"
        pos="absolute"
        top="50%"
        left="50%"
        style={{ transform: 'translate(-50%, -50%)', boxShadow: 'var(--mantine-shadow-md)' }}
      >
        <IconHomeQuestion size={40} stroke={1.6} />
      </ThemeIcon>
    </Box>
  )
}

/**
 * Contenido de la 404.
 *
 * @param {object} props
 * @param {string} [props.title] Qué no se encontró: "Esta propiedad no existe".
 * @param {string} [props.description] Por qué puede pasar y qué hacer.
 * @param {{ to: string, label: string }} [props.back] Acción principal, por
 *   ejemplo volver al listado del recurso. Sin ella, la principal es "Ir al inicio".
 * @param {boolean} [props.showPath] Muestra la dirección pedida. Sirve para las
 *   rutas que no existen; para un registro inexistente el título ya lo dice.
 */
export function NotFound({
  title = 'Esta página no existe',
  description = 'Puede que la dirección esté mal escrita o que la sección haya cambiado de lugar.',
  back,
  showPath = false,
}) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const home = user ? homeFor(user) : '/login'
  // Si la acción principal ya es el inicio, no se repite el botón.
  const showHome = back && back.to !== home

  return (
    <Center py={{ base: 48, sm: 80 }} px="md">
      <Stack align="center" gap="lg" maw={520}>
        <Hero />

        <Stack align="center" gap={6}>
          <Title order={1} size="h2" ta="center">
            {title}
          </Title>
          <Text c="dimmed" ta="center">
            {description}
          </Text>
          {showPath && (
            <Code fz="sm" mt={4} style={{ wordBreak: 'break-all' }}>
              {pathname}
            </Code>
          )}
        </Stack>

        <Group justify="center" gap="sm">
          {back ? (
            <Button component={Link} to={back.to} leftSection={<IconArrowLeft size={18} />}>
              {back.label}
            </Button>
          ) : (
            <Button component={Link} to={home} leftSection={user ? <IconHome size={18} /> : <IconLogin size={18} />}>
              {user ? 'Ir al inicio' : 'Iniciar sesión'}
            </Button>
          )}
          {showHome && (
            <Button component={Link} to={home} variant="subtle" color="gray" leftSection={<IconHome size={18} />}>
              Ir al inicio
            </Button>
          )}
        </Group>
      </Stack>
    </Center>
  )
}

/**
 * 404 a pantalla completa, fuera del panel. Mientras se averigua si hay sesión
 * (el `/me` del arranque) se muestra un spinner, para no ofrecer "Iniciar
 * sesión" a quien ya entró.
 */
export function NotFoundPage(props) {
  const { status } = useAuth()

  if (status === 'checking') {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }

  return (
    <Center mih="100vh" bg="var(--mantine-color-gray-0)">
      <NotFound showPath {...props} />
    </Center>
  )
}
