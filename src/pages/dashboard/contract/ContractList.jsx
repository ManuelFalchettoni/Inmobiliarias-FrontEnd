import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { IconAlertTriangle, IconArrowsSort, IconChevronRight, IconFileText, IconPlus } from '@tabler/icons-react'

import { ActiveFilters, FilterButton } from '../../../components/FilterPanel.jsx'
import { useAuth } from '../../../context/auth-context.js'
import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { useLookup } from '../../../hooks/useLookup.js'
import { usePropertyOptions } from '../../../hooks/useSelectOptions.js'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { queryKeys } from '../../../queries/keys.js'
import {
  CONTRACT_ROLE_LABEL,
  CONTRACT_SEARCH_FILTERS,
  CONTRACT_SORT_OPTIONS,
  CONTRACT_STATUS_COLOR,
  DEFAULT_CONTRACT_SORT,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_TYPE_LABEL,
  formatContractTerm,
  groupPartiesByContract,
  isContractOverdue,
  listAllParties,
  searchContracts,
} from '../../../services/contracts.js'
import { findPerson } from '../../../services/people.js'
import { findProperty, formatPrice, formatPropertyPlace } from '../../../services/properties.js'
import { contractFilterChips } from './contract-filter-chips.js'
import { ContractFilterPanel } from './ContractFilters.jsx'

const PAGE_SIZE = 20

/**
 * Listado de contratos. Muestra las partes de cada uno, pero el backend no deja
 * pedirlas por contrato: se traen todas y se agrupan en el navegador.
 *
 * Como en personas, siempre se usa la búsqueda del backend: todos los filtros
 * son opcionales. Ordena por inicio, más nuevo primero, o por vencimiento
 * (`?orden=vencimiento`), el que vence antes primero. AGENCY y AGENT ven los
 * contratos de sus propiedades; el admin ve todos o elige una inmobiliaria.
 */
export default function ContractList() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { searchParams, page, pick, setFilter, clearFilters, goToPage } = useUrlFilters()
  // El backend ignora el `agencyId` de AGENCY y AGENT: ni se manda.
  const agencyId = isAdmin ? (searchParams.get('agencyId') ?? null) : null
  const filters = pick(CONTRACT_SEARCH_FILTERS)
  const filtrando = Object.keys(filters).length > 0
  // El orden no es un filtro: no cuenta en los chips ni se borra con "Limpiar".
  // Solo viaja si no es el de siempre; cambiarlo vuelve a la página 1 (setFilter).
  const orden = CONTRACT_SORT_OPTIONS.some((o) => o.value === searchParams.get('orden'))
    ? searchParams.get('orden')
    : DEFAULT_CONTRACT_SORT

  const params = {
    page: page - 1,
    size: PAGE_SIZE,
    agencyId,
    ...filters,
    orden: orden === DEFAULT_CONTRACT_SORT ? null : orden,
  }

  // Dos consultas: la página de contratos y TODAS las partes. Las partes tienen
  // una sola clave (las comparte el detalle de cada contrato) y `select` las
  // agrupa: { [contractId]: partes[] }, para buscar las de cada fila por su id.
  const contractsQuery = useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: ({ signal }) => searchContracts(params, { signal }),
    placeholderData: keepPreviousData,
  })
  const agencyOptions = useAgencyOptions(agencyId)
  const propertyOptions = usePropertyOptions(searchParams.get('propertyId'))

  const filterValue = (name) => searchParams.get(name) ?? ''
  const selectFilter = (name) => ({
    value: filterValue(name) || null,
    onChange: (valor) => setFilter(name, valor),
    clearable: true,
  })
  // El input nativo de fecha entrega "yyyy-MM-dd", el formato que pide el backend.
  const dateFilter = (name) => ({
    type: 'date',
    value: filterValue(name),
    onChange: (event) => setFilter(name, event.currentTarget.value, { replace: true }),
  })
  const amountFilter = (name) => ({
    value: filterValue(name),
    onChange: (valor) => setFilter(name, valor, { replace: true }),
    min: 0,
    decimalScale: 2,
    allowNegative: false,
  })

  // El panel lateral con todos los filtros y los chips de lo que está aplicado.
  const [panelAbierto, setPanelAbierto] = useState(false)
  const chips = contractFilterChips(filters, propertyOptions.options)
  const limpiarFiltros = () => clearFilters(CONTRACT_SEARCH_FILTERS)

  const partiesQuery = useQuery({
    queryKey: queryKeys.contractParties.all,
    queryFn: ({ signal }) => listAllParties({ signal }),
    select: groupPartiesByContract,
  })

  const data = contractsQuery.data ?? null
  const failed = contractsQuery.error ?? partiesQuery.error
  const error = failed ? failed.message : null
  const cargando = contractsQuery.isPlaceholderData
  const contracts = data?.content ?? []
  const partiesByContract = partiesQuery.data ?? {}

  const properties = useLookup('properties', contracts.map((c) => c.propertyId), findProperty)
  // Todos los peopleId de las partes de los contratos de esta página.
  // `flatMap` junta las listas de cada contrato en una sola.
  const people = useLookup(
    'people',
    contracts.flatMap((c) => (partiesByContract[c.id] ?? []).map((p) => p.peopleId)),
    findPerson,
  )

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <div>
          <Title order={1} size="h2">
            Contratos
          </Title>
          <Text c="dimmed">
            {data
              ? `${data.totalElements} ${data.totalElements === 1 ? 'contrato' : 'contratos'} de venta y alquiler`
              : error
                ? 'Sin datos'
                : 'Cargando el listado...'}
          </Text>
        </div>

        <Button component={Link} to="/dashboard/contratos/nuevo" leftSection={<IconPlus size={16} />}>
          Nuevo contrato
        </Button>
      </Group>

      {/* Los filtros más usados quedan a mano; el resto, agrupado en el panel. */}
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
        <Select
          w={{ base: '100%', sm: 280 }}
          aria-label="Propiedad"
          placeholder={propertyOptions.state === 'loading' ? 'Cargando propiedades...' : 'Propiedad'}
          data={propertyOptions.options}
          searchable
          nothingFoundMessage="Sin coincidencias"
          {...selectFilter('propertyId')}
        />
        <Select
          w={{ base: '100%', sm: 160 }}
          aria-label="Estado"
          placeholder="Estado"
          data={CONTRACT_STATUS_OPTIONS}
          {...selectFilter('status')}
        />
        <FilterButton count={chips.length} onClick={() => setPanelAbierto(true)} />
        <Select
          w={{ base: '100%', sm: 200 }}
          ml={{ sm: 'auto' }}
          aria-label="Ordenar por"
          data={CONTRACT_SORT_OPTIONS}
          value={orden}
          onChange={(valor) => setFilter('orden', valor === DEFAULT_CONTRACT_SORT ? null : valor)}
          allowDeselect={false}
          leftSection={<IconArrowsSort size={16} />}
        />
      </Group>

      <ActiveFilters chips={chips} onRemove={clearFilters} onClear={limpiarFiltros} />

      <ContractFilterPanel
        opened={panelAbierto}
        onClose={() => setPanelAbierto(false)}
        fields={{ selectFilter, dateFilter, amountFilter }}
        propertyOptions={propertyOptions}
        total={data?.totalElements}
        hayFiltros={filtrando}
        onClear={limpiarFiltros}
      />

      {contractsQuery.isPending && (
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
              <IconFileText size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {filtrando
                ? 'Ningún contrato coincide con los filtros'
                : agencyId
                  ? 'Esta inmobiliaria no tiene contratos'
                  : 'Todavía no hay contratos'}
            </Text>
            {filtrando ? (
              <Button mt="md" variant="light" onClick={() => clearFilters(CONTRACT_SEARCH_FILTERS)}>
                Limpiar filtros
              </Button>
            ) : (
              <Button component={Link} to="/dashboard/contratos/nuevo" mt="md" variant="light">
                Cargar el primero
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {contracts.length > 0 && (
        <>
          <Card
            variant="table"
            radius="lg"
            padding={0}
            style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            <Table.ScrollContainer minWidth={960}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Propiedad</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Partes</Table.Th>
                    <Table.Th ta="right">Monto</Table.Th>
                    <Table.Th>Vigencia</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {contracts.map((contract) => {
                    const property = properties[contract.propertyId]
                    const parties = partiesByContract[contract.id] ?? []
                    const detalle = `/dashboard/contratos/${contract.id}`

                    return (
                      <Table.Tr key={contract.id} style={{ cursor: 'pointer' }} onClick={() => navigate(detalle)}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {property?.address ?? `Propiedad #${contract.propertyId}`}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {property ? formatPropertyPlace(property) : `Contrato #${contract.id}`}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{CONTRACT_TYPE_LABEL[contract.type] ?? contract.type}</Text>
                        </Table.Td>
                        <Table.Td>
                          {parties.length === 0 ? (
                            <Text size="sm" c="orange">
                              Sin partes
                            </Text>
                          ) : (
                            parties.map((party) => (
                              <Text key={party.id} size="sm" style={{ whiteSpace: 'nowrap' }}>
                                <Text span size="xs" c="dimmed">
                                  {CONTRACT_ROLE_LABEL[party.role] ?? party.role}
                                </Text>{' '}
                                {people[party.peopleId]?.name ?? `#${party.peopleId}`}
                              </Text>
                            ))
                          )}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(contract)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                            {formatContractTerm(contract)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={CONTRACT_STATUS_COLOR[contract.status]}>
                            {CONTRACT_STATUS_LABEL[contract.status] ?? contract.status}
                          </Badge>
                          {/* Vigente pero con la fecha de fin ya pasada. */}
                          {isContractOverdue(contract) && (
                            <Badge variant="light" color="orange" ml={4}>
                              Vencido
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Button
                            component={Link}
                            to={detalle}
                            variant="subtle"
                            size="compact-sm"
                            rightSection={<IconChevronRight size={14} />}
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
              <Pagination total={data.totalPages} value={page} onChange={goToPage} />
            </Group>
          )}
        </>
      )}
    </Container>
  )
}
