import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Divider,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconBuildingSkyscraper,
  IconChevronRight,
  IconInfoCircle,
  IconLogout,
  IconPencil,
} from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../../../context/auth-context.js'
import { useLookup } from '../../../hooks/useLookup.js'
import { queryKeys } from '../../../queries/keys.js'
import { AGENCY_STATUS_COLOR, AGENCY_STATUS_SHORT_LABEL, findAgency, formatCuit } from '../../../services/agencies.js'
import { formatDate } from '../../../services/format.js'
import { USER_ROL, USER_ROL_COLOR, USER_ROL_LABEL, findMe } from '../../../services/users.js'
import { AccountCard, PasswordCard, SectionCard } from '../user/UserAccountForms.jsx'

/** "Juan Pérez" -> "JP"; "Manuel" -> "MA". */
function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function PageHeader() {
  return (
    <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Container size="md" py="xl">
        <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Cuenta
          </Text>
          <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
            Configuración
          </Text>
        </Breadcrumbs>
        <Title order={1} size="h2" mb={4}>
          Configuración
        </Title>
        <Text c="dimmed">Tus datos personales y tu contraseña.</Text>
      </Container>
    </Box>
  )
}

/** Resumen de la cuenta: quién es, su rol y desde cuándo. Solo lectura. */
function ProfileCard({ user, agency }) {
  return (
    <Card withBorder radius="lg" padding="xl" shadow="xs">
      <Group gap="lg" wrap="nowrap" align="center">
        <Avatar size={64} radius="xl" color={USER_ROL_COLOR[user.rol] ?? 'gray'}>
          {initials(user.name)}
        </Avatar>
        <Box style={{ minWidth: 0 }}>
          <Group gap="xs" mb={2}>
            <Title order={2} size="h3">
              {user.name}
            </Title>
            <Badge variant="light" color={USER_ROL_COLOR[user.rol]}>
              {USER_ROL_LABEL[user.rol] ?? user.rol}
            </Badge>
          </Group>
          <Text c="dimmed" truncate>
            {user.email}
          </Text>
          <Text size="sm" c="dimmed">
            {user.agencyId != null
              ? `Inmobiliaria: ${agency?.publicName ?? `#${user.agencyId}`}`
              : 'Sin inmobiliaria (registro público)'}
          </Text>
        </Box>
      </Group>

      <Divider my="lg" />

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
        <Text size="sm" c="dimmed">
          Miembro desde{' '}
          <Text span fw={600} c="var(--mantine-color-text)">
            {formatDate(user.createdAt)}
          </Text>
        </Text>
        <Text size="sm" c="dimmed">
          Última modificación{' '}
          <Text span fw={600} c="var(--mantine-color-text)">
            {formatDate(user.updatedAt)}
          </Text>
        </Text>
      </SimpleGrid>
    </Card>
  )
}

/** Un par "etiqueta: valor" de la ficha de la inmobiliaria. */
function Field({ label, children }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm">{children || '—'}</Text>
    </div>
  )
}

/**
 * Inmobiliaria del usuario. El backend no deja cambiar la inmobiliaria de una
 * cuenta, pero sí editar los datos de la propia: el link lleva al formulario.
 */
function AgencyCard({ agencyId, agency }) {
  return (
    <SectionCard
      icon={IconBuildingSkyscraper}
      title="Inmobiliaria"
      description="La inmobiliaria de una cuenta no se puede cambiar."
    >
      {!agency ? (
        <Text size="sm" c="dimmed">
          Inmobiliaria #{agencyId}: no se pudieron cargar sus datos (puede estar dada de baja).
        </Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Field label="Nombre público">{agency.publicName}</Field>
            <Field label="Razón social">{agency.companyName}</Field>
            <Field label="CUIT">{agency.cuit ? formatCuit(agency.cuit) : null}</Field>
            <Field label="Estado">
              <Badge component="span" variant="light" size="sm" color={AGENCY_STATUS_COLOR[agency.status]}>
                {AGENCY_STATUS_SHORT_LABEL[agency.status] ?? agency.status}
              </Badge>
            </Field>
            <Field label="Email">{agency.email}</Field>
            <Field label="Teléfono">{agency.phoneNumber}</Field>
            <Field label="Dirección">{agency.address}</Field>
            <Field label="Web">
              {agency.webURL ? (
                <Anchor href={agency.webURL} target="_blank" rel="noreferrer" size="sm">
                  {agency.webURL}
                </Anchor>
              ) : null}
            </Field>
          </SimpleGrid>
          <Group justify="flex-end" mt="lg">
            <Button
              component={Link}
              to={`/dashboard/agencias/${agency.id}/editar`}
              variant="light"
              leftSection={<IconPencil size={16} />}
            >
              Editar datos de la inmobiliaria
            </Button>
          </Group>
        </>
      )}
    </SectionCard>
  )
}

/** Cierre de sesión. */
function SessionCard({ onLogout }) {
  return (
    <Card withBorder radius="lg" padding="xl" shadow="xs">
      <Group justify="space-between" gap="md">
        <div>
          <Text fw={600}>Sesión</Text>
          <Text size="sm" c="dimmed">
            Cerrá la sesión si estás usando una computadora compartida.
          </Text>
        </div>
        <Button variant="light" color="red" leftSection={<IconLogout size={18} />} onClick={onLogout}>
          Cerrar sesión
        </Button>
      </Group>
    </Card>
  )
}

/**
 * `/dashboard/configuracion`: la cuenta del usuario que inició sesión. Es la
 * única pantalla que puede usar un USER.
 *
 * Los datos se piden frescos con `GET /api/users/me` (el backend saca la cuenta
 * de la cookie) y se editan con los mismos formularios que la edición de
 * usuarios, en modo `self`: `PUT /me` para los datos y `PATCH /me/password`.
 */
export default function AccountSettings() {
  const { logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: ({ signal }) => findMe({ signal }),
  })

  const user = query.data
  const agency = useLookup('agencies', [user?.agencyId], findAgency)[user?.agencyId]

  // Si el rol o la inmobiliaria cambiaron desde el login (un USER al que una
  // inmobiliaria acaba de sumar), la sesión se pone al día con lo que dice `/me`.
  useEffect(() => {
    if (user) refreshUser(user)
  }, [user, refreshUser])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // Al guardar: se actualiza la caché de la cuenta y la sesión (nombre y email
  // del encabezado), sin volver a pedir el usuario.
  const handleSaved = (saved) => {
    queryClient.setQueryData(queryKeys.users.me(), saved)
    refreshUser(saved)
  }

  return (
    <>
      <PageHeader />
      <Container size="md" py="xl">
        {!user && query.isPending && (
          <Stack gap="xl">
            <Skeleton height={150} radius="lg" />
            <Skeleton height={320} radius="lg" />
          </Stack>
        )}

        {/* Un 401 no llega acá: AuthContext limpia la sesión y la app manda al login. */}
        {!user && query.isError && (
          <Alert color="red" icon={<IconAlertTriangle />} title="No se pudo cargar tu cuenta">
            <Text size="sm" mb="sm">
              {query.error.message}
            </Text>
            <Group gap="sm">
              <Button size="xs" variant="light" onClick={() => query.refetch()}>
                Reintentar
              </Button>
              <Button size="xs" variant="subtle" color="red" onClick={handleLogout}>
                Cerrar sesión
              </Button>
            </Group>
          </Alert>
        )}

        {user && (
          <Stack gap="xl">
            {/* El que se registra solo entra como USER: hasta que una inmobiliaria
                lo sume (join-agency) solo puede ver y editar su cuenta. */}
            {user.rol === USER_ROL.USER && (
              <Alert color="blue" icon={<IconInfoCircle />} title="Tu cuenta todavía no es de ninguna inmobiliaria">
                Para usar el panel, pedile a tu inmobiliaria que te sume con tu email ({user.email}). Cuando
                lo haga, el menú se actualiza al volver a esta pantalla, sin registrarte de nuevo.
              </Alert>
            )}
            <ProfileCard user={user} agency={agency} />
            {/* `key`: si cambia la cuenta, el formulario arranca de cero con sus datos. */}
            <AccountCard key={user.id} user={user} onSaved={handleSaved} self />
            <PasswordCard user={user} self />
            {user.agencyId != null && <AgencyCard agencyId={user.agencyId} agency={agency} />}
            <SessionCard onLogout={handleLogout} />
          </Stack>
        )}
      </Container>
    </>
  )
}
