import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconChevronRight } from '@tabler/icons-react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useLookup } from '../../../hooks/useLookup.js'
import { queryKeys } from '../../../queries/keys.js'
import { NotFound } from '../../../components/NotFound.jsx'
import { isNotFound } from '../../../services/api.js'
import { findAgency } from '../../../services/agencies.js'
import { USER_ROL_COLOR, USER_ROL_LABEL, findUser } from '../../../services/users.js'
import { AccountCard, PasswordCard } from './UserAccountForms.jsx'

const LIST_PATH = '/dashboard/usuarios'

function PageHeader({ userId, user }) {
  return (
    <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Container size="md" py="xl">
        <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
          <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
            Usuarios
          </Anchor>
          <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
            Usuario #{userId}
          </Text>
        </Breadcrumbs>
        <Title order={1} size="h2" mb={4}>
          {user ? `Editar a ${user.name}` : 'Editar usuario'}
        </Title>
        <Text c="dimmed">
          El rol y la inmobiliaria no se pueden cambiar. La contraseña se cambia aparte y pide la
          actual.
        </Text>
      </Container>
    </Box>
  )
}

/** `/usuarios/:id/editar`. */
export default function UserEdit() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: ({ signal }) => findUser(id, { signal }),
  })
  // Si ya hay datos se usan aunque falle una recarga en segundo plano (ver PropertyLoader).
  const result = query.data
    ? { user: query.data }
    : query.isError
      ? { error: query.error.message, notFound: isNotFound(query.error) }
      : null

  const user = result?.user
  // useLookup con un solo id: devuelve { [id]: agencia } y se toma la de ese id.
  const agency = useLookup('agencies', [user?.agencyId], findAgency)[user?.agencyId]

  if (result?.notFound) {
    return (
      <NotFound
        title={`El usuario #${id} no existe`}
        description="Puede que nunca haya existido o que esté dado de baja. Si está dado de baja, se restaura desde el listado."
        back={{ to: LIST_PATH, label: 'Volver a usuarios' }}
      />
    )
  }

  return (
    <>
      <PageHeader userId={id} user={user} />
      <Container size="md" py="xl">
        {!result && <Skeleton height={420} radius="lg" />}

        {result?.error && (
          <Alert color="red" icon={<IconAlertTriangle />} title="No se puede editar el usuario">
            {result.error}{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Volver al listado
            </Anchor>
          </Alert>
        )}

        {user && (
          <Stack gap="xl">
            <Group gap="sm">
              <Badge variant="light" color={USER_ROL_COLOR[user.rol]}>
                {USER_ROL_LABEL[user.rol] ?? user.rol}
              </Badge>
              <Text size="sm" c="dimmed">
                {user.agencyId != null
                  ? `Inmobiliaria: ${agency?.publicName ?? `#${user.agencyId}`}`
                  : 'Sin inmobiliaria (registro público)'}
              </Text>
            </Group>

            {/* El rol y la inmobiliaria se muestran arriba solo para consulta:
                el backend no permite cambiarlos. Al guardar, AccountCard
                devuelve el usuario actualizado y se reemplaza el de la página. */}
            <AccountCard key={user.id} user={user} onSaved={(saved) => queryClient.setQueryData(queryKeys.users.detail(id), saved)} />
            <PasswordCard user={user} />

            <Group>
              <Button component={Link} to={LIST_PATH} variant="subtle" color="gray">
                Volver al listado
              </Button>
            </Group>
          </Stack>
        )}
      </Container>
    </>
  )
}
