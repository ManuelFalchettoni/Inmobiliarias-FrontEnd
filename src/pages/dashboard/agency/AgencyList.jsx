import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Menu,
  Pagination,
  SegmentedControl,
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
  IconBuildingSkyscraper,
  IconDots,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react'

import {
  AGENCY_STATUS_COLOR,
  AGENCY_STATUS_OPTIONS,
  AGENCY_STATUS_SHORT_LABEL,
  agencyToRequest,
  deleteAgency,
  listAgencies,
  restoreAgency,
  updateAgency,
} from '../../../services/agencies.js'
import { formatDate } from '../../../services/format.js'
import { queryKeys } from '../../../queries/keys.js'

const PAGE_SIZE = 20

function getInitials(name) {
  const initials = String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
  return initials || 'AG'
}

/** Acciones de una fila: cambiar el estado de verificación, dar de baja o restaurar. */
function AgencyActions({ agency, onAction, disabled }) {
  // `onAction(agency, work)`: el listado ejecuta `work` (el pedido) y después
  // recarga la página. Acá solo se decide QUÉ pedido hacer.
  // Una agencia dada de baja solo se puede restaurar.
  if (agency.active === false) {
    return (
      <Button
        size="compact-sm"
        variant="light"
        leftSection={<IconArrowBackUp size={14} />}
        disabled={disabled}
        onClick={() => onAction(agency, () => restoreAgency(agency.id))}
      >
        Restaurar
      </Button>
    )
  }

  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon
        component={Link}
        to={`/dashboard/agencias/${agency.id}/editar`}
        variant="subtle"
        aria-label={`Editar ${agency.publicName}`}
      >
        <IconPencil size={18} />
      </ActionIcon>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" disabled={disabled} aria-label={`Acciones de ${agency.publicName}`}>
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Estado de verificación</Menu.Label>
          {/* Un ítem por cada estado distinto del actual. El PUT pisa todos los
              campos, así que se arma con agencyToRequest y solo cambia `status`. */}
          {AGENCY_STATUS_OPTIONS.filter((option) => option.value !== agency.status).map((option) => (
            <Menu.Item
              key={option.value}
              leftSection={<Badge size="xs" circle color={AGENCY_STATUS_COLOR[option.value]} />}
              onClick={() =>
                onAction(agency, () => updateAgency(agency.id, agencyToRequest(agency, { status: option.value })))
              }
            >
              Pasar a {option.label.toLowerCase()}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconArchive size={16} />}
            onClick={() => onAction(agency, () => deleteAgency(agency.id))}
          >
            Dar de baja
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  )
}

/** Listado de agencias: mismo patrón que el de propiedades, con acciones por fila. */
export default function AgencyList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1)
  const active = searchParams.get('active') ?? 'true'

  const queryClient = useQueryClient()
  const params = { page: page - 1, size: PAGE_SIZE, active }

  // Mismo patrón que el listado de propiedades (ver PropertyList).
  const query = useQuery({
    queryKey: queryKeys.agencies.list(params),
    queryFn: ({ signal }) => listAgencies(params, { signal }),
    placeholderData: keepPreviousData,
  })

  /**
   * Las acciones de las filas (cambiar el estado, dar de baja, restaurar) son
   * "mutaciones": pedidos que modifican datos. useMutation lleva su estado
   * (`isPending`, `isError`, `error`) y `onSettled` corre al terminar, salga
   * bien o mal: ahí se invalida la caché de agencias para mostrar el estado
   * real del backend (también se actualiza el total del menú).
   * `variables` guarda lo que se pasó a `mutate`, para nombrar la agencia en el error.
   */
  const action = useMutation({
    mutationFn: ({ work }) => work(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.agencies.all }),
  })

  const setFiltro = (valor) => setSearchParams({ active: valor })
  const irAPagina = (nuevaPagina) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nuevaPagina))
    setSearchParams(next)
  }

  // Lo que llaman las filas: `work` es la función que hace el pedido.
  const runAction = (agency, work) => action.mutate({ agency, work })

  const data = query.data ?? null
  const error = query.isError ? query.error.message : null
  const cargando = query.isPlaceholderData
  const verArchivadas = active === 'false'

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconBuildingSkyscraper size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Agencias
            </Title>
            <Text c="dimmed">
              {data
                ? `${data.totalElements} ${data.totalElements === 1 ? 'agencia' : 'agencias'}`
                : error
                  ? 'Sin datos'
                  : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/agencias/nueva" leftSection={<IconPlus size={16} />}>
          Nueva agencia
        </Button>
      </Group>

      <SegmentedControl
        mb="md"
        value={active}
        onChange={setFiltro}
        data={[
          { value: 'true', label: 'Activas' },
          { value: 'false', label: 'Dadas de baja' },
        ]}
      />

      {action.isError && (
        <Alert
          color="red"
          icon={<IconAlertTriangle />}
          title="No se pudo completar la acción"
          mb="md"
          withCloseButton
          // `reset` vuelve la mutación a su estado inicial y oculta el aviso.
          onClose={action.reset}
        >
          {action.variables?.agency.publicName}: {action.error.message}
        </Alert>
      )}

      {query.isPending && (
        <Stack gap="xs">
          {Array.from({ length: 4 }, (_, i) => (
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
              <IconBuildingSkyscraper size={28} />
            </ThemeIcon>
            <Text fw={600}>{verArchivadas ? 'No hay agencias dadas de baja' : 'Todavía no hay agencias'}</Text>
            {!verArchivadas && (
              <Button component={Link} to="/dashboard/agencias/nueva" mt="md" variant="light">
                Dar de alta la primera
              </Button>
            )}
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
                    <Table.Th>Agencia</Table.Th>
                    <Table.Th>CUIT</Table.Th>
                    <Table.Th>Contacto</Table.Th>
                    <Table.Th>Dirección</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Alta</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.content.map((agency) => (
                    <Table.Tr key={agency.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar color="dark" variant="filled" radius="md" size={36}>
                            {getInitials(agency.publicName)}
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500}>
                              {agency.publicName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {agency.companyName}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {agency.cuit}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{agency.email}</Text>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {agency.phoneNumber}
                        </Text>
                        {agency.webURL && (
                          <Anchor href={agency.webURL} target="_blank" rel="noreferrer" size="xs">
                            {agency.webURL.replace(/^https?:\/\//, '')}
                          </Anchor>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{agency.address}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={AGENCY_STATUS_COLOR[agency.status]}>
                          {AGENCY_STATUS_SHORT_LABEL[agency.status] ?? agency.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(agency.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <AgencyActions
                          agency={agency}
                          onAction={runAction}
                          disabled={action.isPending}
                        />
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
