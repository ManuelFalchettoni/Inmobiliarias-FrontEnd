import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Container,
  Divider,
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
import { IconAlertTriangle, IconPencil, IconPlus, IconSearch, IconUsersGroup } from '@tabler/icons-react'

import FilterInput from '../../../components/FilterInput.jsx'
import { ActiveFilters, FilterButton, FilterPanel, FilterSection } from '../../../components/FilterPanel.jsx'
import { useAuth } from '../../../context/auth-context.js'
import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { useLookup } from '../../../hooks/useLookup.js'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { queryKeys } from '../../../queries/keys.js'
import { findAgency } from '../../../services/agencies.js'
import { formatDate } from '../../../services/format.js'
import { PEOPLE_SEARCH_FILTERS, searchPeople } from '../../../services/people.js'

const PAGE_SIZE = 20

/** Cómo se llama cada filtro en su chip. */
const FILTER_LABEL = {
  name: 'Nombre',
  dni: 'DNI',
  cuit: 'CUIT',
  phone: 'Teléfono',
  email: 'Email',
  address: 'Dirección',
}

/**
 * Listado de personas, siempre con la búsqueda del backend: pagina, ordena por
 * nombre y todos los filtros son opcionales. AGENCY y AGENT ven solo su
 * cartera; el admin ve todas o elige una inmobiliaria.
 */
export default function PeopleList() {
  const { isAdmin } = useAuth()
  const { searchParams, page, pick, setFilter, clearFilters, goToPage } = useUrlFilters()
  // El backend ignora el `agencyId` de AGENCY y AGENT: ni se manda.
  const agencyId = isAdmin ? (searchParams.get('agencyId') ?? null) : null
  const filters = pick(PEOPLE_SEARCH_FILTERS)
  const filtrando = Object.keys(filters).length > 0

  const params = { page: page - 1, size: PAGE_SIZE, agencyId, ...filters }

  // Mismo patrón que el listado de propiedades (ver PropertyList).
  const query = useQuery({
    queryKey: queryKeys.people.list(params),
    queryFn: ({ signal }) => searchPeople(params, { signal }),
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
  })

  // El panel lateral con todos los filtros y un chip por cada uno aplicado.
  const [panelAbierto, setPanelAbierto] = useState(false)
  const chips = PEOPLE_SEARCH_FILTERS.filter((name) => filters[name]).map((name) => ({
    key: name,
    label: `${FILTER_LABEL[name]}: ${filters[name]}`,
    names: [name],
  }))
  const limpiarFiltros = () => clearFilters(PEOPLE_SEARCH_FILTERS)

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <div>
          <Title order={1} size="h2">
            Personas
          </Title>
          <Text c="dimmed">
            {data
              ? `${data.totalElements} ${data.totalElements === 1 ? 'persona' : 'personas'}, por nombre`
              : 'Cargando el listado...'}
          </Text>
        </div>

        <Button component={Link} to="/dashboard/personas/nueva" leftSection={<IconPlus size={16} />}>
          Nueva persona
        </Button>
      </Group>

      {/* El nombre queda a mano; el resto, en el panel. Todos los de texto son
          parciales: "garc" encuentra "García", "3012" un DNI que lo contenga. */}
      <Group gap="sm" mb={chips.length > 0 ? 'sm' : 'lg'}>
        {/* Elegir inmobiliaria es solo del admin: los demás ven siempre la suya. */}
        {isAdmin && (
          <Select
            w={{ base: '100%', sm: 240 }}
            aria-label="Inmobiliaria"
            placeholder={agencyOptions.state === 'loading' ? 'Cargando inmobiliarias...' : 'Todas las inmobiliarias'}
            data={agencyOptions.options}
            value={agencyId}
            onChange={(valor) => setFilter('agencyId', valor)}
            searchable
            clearable
            nothingFoundMessage="Sin coincidencias"
          />
        )}
        <FilterInput
          w={{ base: '100%', sm: 260 }}
          aria-label="Nombre"
          placeholder="Buscar por nombre"
          leftSection={<IconSearch size={16} />}
          {...textFilter('name')}
        />
        <FilterButton count={chips.length} onClick={() => setPanelAbierto(true)} />
      </Group>

      <ActiveFilters chips={chips} onRemove={clearFilters} onClear={limpiarFiltros} />

      <FilterPanel
        opened={panelAbierto}
        onClose={() => setPanelAbierto(false)}
        total={data?.totalElements}
        noun={['persona', 'personas']}
        hayFiltros={filtrando}
        onClear={limpiarFiltros}
      >
        <FilterSection title="Identidad">
          <FilterInput label="Nombre" placeholder="Cualquiera" {...textFilter('name')} />
          <SimpleGrid cols={2}>
            <FilterInput label="DNI" placeholder="Cualquiera" {...textFilter('dni')} />
            <FilterInput label="CUIT" placeholder="Cualquiera" {...textFilter('cuit')} />
          </SimpleGrid>
        </FilterSection>

        <Divider />

        <FilterSection title="Contacto">
          <SimpleGrid cols={2}>
            <FilterInput label="Teléfono" placeholder="Cualquiera" {...textFilter('phone')} />
            <FilterInput label="Email" placeholder="Cualquiera" {...textFilter('email')} />
          </SimpleGrid>
          <FilterInput label="Dirección" placeholder="Cualquiera" {...textFilter('address')} />
        </FilterSection>
      </FilterPanel>

      {query.isPending && (
        <Stack gap="xs">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={52} radius="md" />
          ))}
        </Stack>
      )}

      {error && (
        <Alert color="danger" icon={<IconAlertTriangle />} title="No se pudo cargar el listado">
          {error}
        </Alert>
      )}

      {data?.content.length === 0 && (
        <Card variant="empty" radius="lg" padding="xl">
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconUsersGroup size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {filtrando
                ? 'Ninguna persona coincide con los filtros'
                : agencyId
                  ? 'Esta inmobiliaria no tiene personas cargadas'
                  : 'Todavía no hay personas cargadas'}
            </Text>
            {filtrando ? (
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
            variant="table"
            radius="lg"
            padding={0}
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
