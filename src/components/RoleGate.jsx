import { Link, Outlet } from 'react-router-dom'
import { Button, Card, Container, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconArrowRight, IconLock } from '@tabler/icons-react'

import { useAuth } from '../context/auth-context.js'
import { homeFor } from '../layouts/dashboard-nav.js'
import { USER_ROL, USER_ROL_LABEL, hasRole } from '../services/users.js'

/**
 * Lo que ve quien entra a una pantalla de otro rol. El backend respondería 403
 * a todo lo que la pantalla pida, así que ni se monta.
 */
export function Forbidden() {
  const { user } = useAuth()
  // Un USER (registro público) todavía no es de ninguna inmobiliaria.
  const withoutAgency = user?.rol === USER_ROL.USER

  return (
    <Container size="sm" py="xl">
      <Card withBorder radius="lg" padding="xl" shadow="xs">
        <Stack align="center" gap="xs" py="xl">
          <ThemeIcon variant="light" color="gray" size={56} radius="xl">
            <IconLock size={28} />
          </ThemeIcon>
          <Text fw={600}>Sin permiso</Text>
          <Text size="sm" c="dimmed" ta="center" maw={460}>
            {withoutAgency
              ? 'Tu cuenta todavía no pertenece a ninguna inmobiliaria. Pedile a la tuya que te sume con tu email.'
              : `Tu rol (${USER_ROL_LABEL[user?.rol] ?? user?.rol}) no tiene acceso a esta sección.`}
          </Text>
          <Button
            component={Link}
            to={homeFor(user)}
            mt="md"
            variant="light"
            rightSection={<IconArrowRight size={16} />}
          >
            Ir al inicio
          </Button>
        </Stack>
      </Card>
    </Container>
  )
}

/**
 * Ruta "envoltorio" que deja pasar solo a esos roles: las rutas de adentro se
 * dibujan en su `<Outlet />`, y para el resto se muestra "Sin permiso".
 */
export default function RoleGate({ roles }) {
  const { user } = useAuth()
  return hasRole(user, roles) ? <Outlet /> : <Forbidden />
}
