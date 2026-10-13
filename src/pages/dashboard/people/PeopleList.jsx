import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Container,
  Group,
  Pagination,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconFilterOff, IconPencil, IconPlus, IconUsersGroup } from '@tabler/icons-react'

import FilterInput from '../../../components/FilterInput.jsx'
import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { useLookup } from '../../../hooks/useLookup.js'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { queryKeys } from '../../../queries/keys.js'
import { findAgency } from '../../../services/agencies.js'
import { formatDate } from '../../../services/format.js'
import { PEOPLE_SEARCH_FILTERS, listPeople, searchPeople } from '../../../services/people.js'

const PAGE_SIZE = 20

/**
 * Listado de personas. Sin inmobiliaria elegida es el listado general, en el
 * orden en que se cargaron. Con una, pasa a la búsqueda del backend, que exige
 * `agencyId` y ordena por nombre: recién ahí se puede filtrar por texto.
 */
export default function PeopleList() {
  const { searchParams, page, pick, setFilter, clearFilters, goToPage } = useUrlFilters()
  const agencyId = searchParams.get('agencyId') ?? null
  const filters = pick(PEOPLE_SEARCH_FILTERS)
  const filtrando = Object.keys(filters).length > 0

  // Los filtros de texto sin inmobiliaria no se mandan: el backend daría 400.
  const params = agencyId
    ? { page: page - 1, size: PAGE_SIZE, agencyId, ...filters }
    : { page: page - 1, size: PAGE_SIZE }

  // Mismo patrón que el listado de propiedades (ver PropertyList).
  const query = useQuery({
    queryKey: queryKeys.people.list(params),
    queryFn: ({ signal }) => (agencyId ? searchPeople : listPeople)(params, { signal }),
    placeholderData: keepPreviousData,
  })

  const data = query.data ?? null
  const error = query.isError ? query.error.message : null
  const cargando = query.isPlaceholderData
  // Nombre de la inmobiliaria de cada persona (la respuesta trae solo el id).
  const agencies = useLookup('agencies', data?.content.map((p) => p.agencyId) ?? [], findAgency)
  // Opciones del filtro por inmobiliaria.
  const agencyOptions = useAgencyOptions(agencyId)

  const textFilter = (name) => ({
    value: searchParams.get(name) ?? '',
    onChange: (valor) => setFilter(name, valor, { replace: true }),
    disabled: !agencyId,
  })

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconUsersGroup size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Personas
            </Title>
            <Text c="dimmed">
              {data
                ? `${data.totalElements} ${data.totalElements === 1 ? 'persona' : 'personas'}, ${
                    agencyId ? 'por nombre' : 'en el orden en que se cargaron'
                  }`
                : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/personas/nueva" leftSection={<IconPlus size={16} />}>
          Nueva persona
        </Button>
      </Group>

      {/* Todos los de texto son parciales: "garc" encuentra "García", "3012" un DNI que lo contenga. */}
      <Card withBorder radius="lg" shadow="xs" mb="md">
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          <Select
            label="Inmobiliaria"
            placeholder={agencyOptions.state === 'loading' ? 'Cargando inmobiliarias...' : 'Todas'}
            data={agencyOptions.options}
            value={agencyId}
            onChange={(valor) => setFilter('agencyId', valor)}
            searchable
            clearable
            nothingFoundMessage="Sin coincidencias"
          />
          <FilterInput label="Nombre" {...textFilter('name')} />
          <FilterInput label="DNI" {...textFilter('dni')} />
          <FilterInput label="CUIT" {...textFilter('cuit')} />
          <FilterInput label="Teléfono" {...textFilter('phone')} />
          <FilterInput label="Email" {...textFilter('email')} />
          <FilterInput label="Dirección" {...textFilter('address')} />
          {filtrando && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} />}
              style={{ alignSelf: 'end' }}
              onClick={() => clearFilters(PEOPLE_SEARCH_FILTERS)}
            >
              Limpiar filtros
            </Button>
          )}
        </SimpleGrid>
        {!agencyId && (
          <Text size="xs" c="dimmed" mt="sm">
            Elegí una inmobiliaria para buscar: cada una busca solo en su cartera.
          </Text>
        )}
      </Card>

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
              <IconUsersGroup size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {agencyId && filtrando
                ? 'Ninguna persona coincide con los filtros'
                : agencyId
                  ? 'Esta inmobiliaria no tiene personas cargadas'
                  : 'Todavía no hay personas cargadas'}
            </Text>
            {agencyId && filtrando ? (
              <Button mt="md" variant="light" onClick={() => clearFilters(PEOPLE_SEARCH_FILTERS)}>
                Limpiar filtros
              </Button>
            ) : (
              <Button component={Link} to="/dashboard/personas/nueva" mt="md" variant="light">
                Cargar la primera
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
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Contacto</Table.Th>
                    <Table.Th>Documento</Table.Th>
                    <Table.Th>Inmobiliaria</Table.Th>
                    <Table.Th>Alta</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.content.map((persona) => (
                    <Table.Tr key={persona.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {persona.name}
                        </Text>
                        {persona.address && (
                          <Text size="xs" c="dimmed">
                            {persona.address}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{persona.email}</Text>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {persona.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {persona.dni ? `DNI ${persona.dni}` : '—'}
                        </Text>
                        {persona.cuit && (
                          <Text size="xs" c="dimmed" ff="monospace">
                            CUIT {persona.cuit}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {agencies[persona.agencyId]?.publicName ?? `#${persona.agencyId}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(persona.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          component={Link}
                          to={`/dashboard/personas/${persona.id}/editar`}
                          variant="subtle"
                          aria-label={`Editar ${persona.name}`}
                        >
                          <IconPencil size={18} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          {data.totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination total={data.totalPages} value={page} onChange={goToPage} />
            </Group>
          )}
        </>
      )}
    </Container>
  )
}
