import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Menu,
  Pagination,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowBackUp,
  IconDots,
  IconPencil,
  IconPlus,
  IconUsers,
} from '@tabler/icons-react'

import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { useLookup } from '../../../hooks/useLookup.js'
import { findAgency } from '../../../services/agencies.js'
import { formatDate } from '../../../services/format.js'
import {
  USER_ROL_COLOR,
  USER_ROL_LABEL,
  deleteUser,
  listUsers,
  restoreUser,
} from '../../../services/users.js'

const PAGE_SIZE = 20

/** Acciones de una fila: editar y dar de baja, o restaurar si está dado de baja. */
function UserActions({ user, onAction, disabled }) {
  if (user.active === false) {
    return (
      <Button
        size="compact-sm"
        variant="light"
        leftSection={<IconArrowBackUp size={14} />}
        disabled={disabled}
        onClick={() => onAction(user, () => restoreUser(user.id))}
      >
        Restaurar
      </Button>
    )
  }

  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon
        component={Link}
        to={`/dashboard/usuarios/${user.id}/editar`}
        variant="subtle"
        aria-label={`Editar ${user.name}`}
      >
        <IconPencil size={18} />
      </ActionIcon>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" disabled={disabled} aria-label={`Acciones de ${user.name}`}>
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            color="red"
            leftSection={<IconArchive size={16} />}
            onClick={() => onAction(user, () => deleteUser(user.id))}
          >
            Dar de baja
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  )
}

export default function UserList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1)
  const active = searchParams.get('active') ?? 'true'
  const agencyId = searchParams.get('agencyId') ?? null

  // `version` vuelve a pedir la página después de una acción.
  const [version, setVersion] = useState(0)
  const clave = `${page}|${active}|${agencyId}|${version}`
  const [resultado, setResultado] = useState(null) // { clave, data, error }
  const cargando = resultado?.clave !== clave
  const [accion, setAccion] = useState({ state: 'idle' })

  useEffect(() => {
    const controller = new AbortController()

    listUsers({ page: page - 1, size: PAGE_SIZE, active, agencyId }, { signal: controller.signal })
      .then((data) => setResultado({ clave, data, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setResultado({ clave, data: null, error: err.message })
      })

    return () => controller.abort()
  }, [clave, page, active, agencyId])

  const data = resultado?.data ?? null
  const error = resultado?.error ?? null
  const agencyNames = useLookup('agencies', data?.content.map((u) => u.agencyId) ?? [], findAgency)
  const agencies = useAgencyOptions(agencyId)

  /** Al cambiar un filtro se vuelve a la página 1. */
  const setFiltro = (nombre, valor) => {
    const next = new URLSearchParams(searchParams)
    if (valor) next.set(nombre, valor)
    else next.delete(nombre)
    next.delete('page')
    setSearchParams(next)
  }

  const irAPagina = (nuevaPagina) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nuevaPagina))
    setSearchParams(next)
  }

  const runAction = async (user, work) => {
    setAccion({ state: 'saving' })
    try {
      await work()
      setAccion({ state: 'idle' })
    } catch (err) {
      setAccion({ state: 'error', message: `${user.name}: ${err.message}` })
    }
    setVersion((v) => v + 1)
  }

  const verArchivados = active === 'false'

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconUsers size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Usuarios
            </Title>
            <Text c="dimmed">
              {data
                ? `${data.totalElements} ${data.totalElements === 1 ? 'usuario' : 'usuarios'}`
                : error
                  ? 'Sin datos'
                  : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/usuarios/nuevo" leftSection={<IconPlus size={16} />}>
          Nuevo usuario
        </Button>
      </Group>

      <Group mb="md" align="flex-end" gap="md">
        <SegmentedControl
          value={active}
          onChange={(valor) => setFiltro('active', valor)}
          data={[
            { value: 'true', label: 'Activos' },
            { value: 'false', label: 'Dados de baja' },
          ]}
        />
        <Select
          w={300}
          aria-label="Inmobiliaria"
          placeholder={agencies.state === 'loading' ? 'Cargando inmobiliarias...' : 'Todas las inmobiliarias'}
          data={agencies.options}
          value={agencyId}
          onChange={(valor) => setFiltro('agencyId', valor)}
          searchable
          clearable
          nothingFoundMessage="Sin coincidencias"
        />
      </Group>

      {accion.state === 'error' && (
        <Alert
          color="red"
          icon={<IconAlertTriangle />}
          title="No se pudo completar la acción"
          mb="md"
          withCloseButton
          onClose={() => setAccion({ state: 'idle' })}
        >
          {accion.message}
        </Alert>
      )}

      {cargando && resultado == null && (
        <Stack gap="xs">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={52} radius="md" />
          ))}
        </Stack>
      )}

      {error && (
        <Alert color="red" icon={<IconAlertTriangle />} title="No se pudo cargar el listado">
          {error}
        </Alert>
      )}

      {data?.content.length === 0 && (
        <Card withBorder radius="lg" padding="xl" shadow="xs">
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconUsers size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {verArchivados
                ? 'No hay usuarios dados de baja'
                : agencyId
                  ? 'Esta inmobiliaria no tiene usuarios'
                  : 'Todavía no hay usuarios'}
            </Text>
          </Stack>
        </Card>
      )}

      {data?.content.length > 0 && (
        <>
          <Card
            withBorder
            radius="lg"
            padding={0}
            shadow="xs"
            style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            <Table.ScrollContainer minWidth={860}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Contacto</Table.Th>
                    <Table.Th>Rol</Table.Th>
                    <Table.Th>Inmobiliaria</Table.Th>
                    <Table.Th>CUIT y matrícula</Table.Th>
                    <Table.Th>Alta</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.content.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {user.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{user.email}</Text>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {user.phoneNumber}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={USER_ROL_COLOR[user.rol]}>
                          {USER_ROL_LABEL[user.rol] ?? user.rol}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {/* Las cuentas del registro público no tienen inmobiliaria. */}
                        {user.agencyId != null ? (
                          <Text size="sm">{agencyNames[user.agencyId]?.publicName ?? `#${user.agencyId}`}</Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Sin inmobiliaria
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {user.cuit || user.license ? (
                          <>
                            {user.cuit && (
                              <Text size="sm" ff="monospace">
                                {user.cuit}
                              </Text>
                            )}
                            {user.license && (
                              <Text size="xs" c="dimmed">
                                Mat. {user.license}
                              </Text>
                            )}
                          </>
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(user.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <UserActions user={user} onAction={runAction} disabled={accion.state === 'saving'} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          {data.totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination total={data.totalPages} value={page} onChange={irAPagina} />
            </Group>
          )}
        </>
      )}
    </Container>
  )
}
