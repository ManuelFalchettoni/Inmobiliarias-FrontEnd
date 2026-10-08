import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconChevronRight, IconMessages, IconPlus } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { useUserOptions } from '../../../hooks/useSelectOptions.js'
import { queryKeys } from '../../../queries/keys.js'
import { CRM_STAGE_COLOR, CRM_STAGE_LABEL, listLeads } from '../../../services/crm.js'
import { formatDate } from '../../../services/format.js'
import { findPerson } from '../../../services/people.js'
import { findProperty, formatPropertyPlace } from '../../../services/properties.js'
import { findUser } from '../../../services/users.js'

const PAGE_SIZE = 20

/**
 * Listado de leads (`/dashboard/consultas`), filtrable por agente. Cada lead
 * trae solo ids (persona, propiedad, agente): los nombres se buscan con useLookup.
 */
export default function LeadList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1)
  const userId = searchParams.get('userId') ?? null

  const params = { page: page - 1, size: PAGE_SIZE, userId }

  // Mismo patrón que el listado de propiedades (ver PropertyList).
  const query = useQuery({
    queryKey: queryKeys.leads.list(params),
    queryFn: ({ signal }) => listLeads(params, { signal }),
    placeholderData: keepPreviousData,
  })

  const data = query.data ?? null
  const error = query.isError ? query.error.message : null
  const cargando = query.isPlaceholderData
  const leads = data?.content ?? []

  // Tres búsquedas con caché: si varios leads son de la misma persona o del
  // mismo agente, se pide una sola vez.
  const people = useLookup('people', leads.map((l) => l.peopleId), findPerson)
  const properties = useLookup('properties', leads.map((l) => l.propertyId), findProperty)
  const users = useLookup('users', leads.map((l) => l.userId), findUser)
  // Opciones del filtro por agente.
  const agents = useUserOptions(userId)

  const setFiltro = (valor) => {
    const next = new URLSearchParams()
    if (valor) next.set('userId', valor)
    setSearchParams(next)
  }

  const irAPagina = (nuevaPagina) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nuevaPagina))
    setSearchParams(next)
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconMessages size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Clientes & Leads
            </Title>
            <Text c="dimmed">
              {data
                ? `${data.totalElements} ${data.totalElements === 1 ? 'lead' : 'leads'}: interesados en una propiedad, con su agente y su etapa`
                : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/consultas/nuevo" leftSection={<IconPlus size={16} />}>
          Nuevo lead
        </Button>
      </Group>

      <Select
        mb="md"
        maw={360}
        label="Agente"
        placeholder={agents.state === 'loading' ? 'Cargando agentes...' : 'Todos los agentes'}
        data={agents.options}
        value={userId}
        onChange={setFiltro}
        searchable
        clearable
        nothingFoundMessage="Sin coincidencias"
      />

      {query.isPending && (
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
              <IconMessages size={28} />
            </ThemeIcon>
            <Text fw={600}>{userId ? 'Este agente no tiene leads' : 'Todavía no hay leads'}</Text>
            <Button component={Link} to="/dashboard/consultas/nuevo" mt="md" variant="light">
              Cargar un lead
            </Button>
          </Stack>
        </Card>
      )}

      {leads.length > 0 && (
        <>
          <Card
            withBorder
            radius="lg"
            padding={0}
            shadow="xs"
            style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            <Table.ScrollContainer minWidth={820}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Interesado</Table.Th>
                    <Table.Th>Propiedad</Table.Th>
                    <Table.Th>Agente</Table.Th>
                    <Table.Th>Etapa</Table.Th>
                    <Table.Th>Alta</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {leads.map((lead) => {
                    const person = people[lead.peopleId]
                    const property = properties[lead.propertyId]
                    const detalle = `/dashboard/consultas/${lead.id}`

                    // Toda la fila lleva al detalle. Mientras llegan los nombres
                    // se muestra el id ("Persona #3") en vez de dejar el lugar vacío.
                    return (
                      <Table.Tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => navigate(detalle)}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {person?.name ?? `Persona #${lead.peopleId}`}
                          </Text>
                          {person && (
                            <Text size="xs" c="dimmed" ff="monospace">
                              {person.phone}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{property?.address ?? `Propiedad #${lead.propertyId}`}</Text>
                          {property && (
                            <Text size="xs" c="dimmed">
                              {formatPropertyPlace(property)}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{users[lead.userId]?.name ?? `#${lead.userId}`}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={CRM_STAGE_COLOR[lead.stage]}>
                            {CRM_STAGE_LABEL[lead.stage] ?? lead.stage}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatDate(lead.createdAt)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            component={Link}
                            to={detalle}
                            variant="subtle"
                            size="compact-sm"
                            rightSection={<IconChevronRight size={14} />}
                            // stopPropagation: el clic no "sube" a la fila, que
                            // también navegaría (se haría dos veces).
                            onClick={(event) => event.stopPropagation()}
                          >
                            Abrir
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
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
