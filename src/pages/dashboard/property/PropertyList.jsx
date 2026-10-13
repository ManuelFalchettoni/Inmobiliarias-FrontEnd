import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Collapse,
  Container,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconBuildingEstate,
  IconFilterOff,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react'

import FilterInput from '../../../components/FilterInput.jsx'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { queryKeys } from '../../../queries/keys.js'
import {
  OPERATION_TYPE_LABEL,
  PROPERTY_CONDITION_COLOR,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_CONDITION_OPTIONS,
  PROPERTY_OCCUPANCY_OPTIONS,
  PROPERTY_SEARCH_FILTERS,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPE_OPTIONS,
  formatPrice,
  formatPropertyPlace,
  listProperties,
  searchProperties,
  sortPhotos,
  sortPrices,
} from '../../../services/properties.js'

const PAGE_SIZE = 20

/** Los filtros que van en "Más filtros": si alguno tiene valor, el panel arranca abierto. */
const EXTRA_FILTERS = ['province', 'county', 'occupancy', 'minSize', 'maxSize', 'minYear', 'maxYear']

/**
 * Listado de propiedades (`/dashboard/propiedades`). Es el modelo que siguen
 * todos los listados del panel: página y filtros en la URL, un `useQuery` que
 * pide los datos y una tabla que no "parpadea" al cambiar de página.
 */
export default function PropertyList() {
  // La página y los filtros viven en la URL: el listado queda compartible y
  // sumar filtros nuevos no obliga a declarar más estado.
  const { searchParams, page, pick, setFilter, clearFilters, goToPage } = useUrlFilters()
  const active = searchParams.get('active') ?? 'true'
  const verArchivadas = active === 'false'

  // La búsqueda del backend solo trae publicadas: con "Dadas de baja" los
  // filtros no se muestran ni se mandan (quedan en la URL para cuando se vuelva).
  const filters = verArchivadas ? {} : pick(PROPERTY_SEARCH_FILTERS)
  const filtrando = Object.keys(filters).length > 0
  const filterValue = (name) => searchParams.get(name) ?? ''

  const [masFiltros, setMasFiltros] = useState(() => EXTRA_FILTERS.some((name) => searchParams.get(name)))

  // Spring cuenta desde 0. Con algún filtro se usa /search, sin filtros el
  // listado de siempre: la clave decide sola a qué endpoint se pide.
  const params = filtrando
    ? { page: page - 1, size: PAGE_SIZE, ...filters }
    : { page: page - 1, size: PAGE_SIZE, active }

  // useQuery pide la página y la guarda en la caché con la clave
  // ['properties', 'list', params]. Cuando cambian la página o el filtro, cambia
  // la clave y React Query pide la nueva; si ya la tenía (volver a la página 1),
  // la muestra al instante. También cancela el pedido viejo con el `signal`.
  const query = useQuery({
    queryKey: queryKeys.properties.list(params),
    queryFn: ({ signal }) => (filtrando ? searchProperties : listProperties)(params, { signal }),
    // Mientras llega la página nueva se sigue mostrando la anterior: si no, la
    // tabla y el paginador desaparecen en cada clic y el usuario pierde el lugar.
    placeholderData: keepPreviousData,
  })

  const data = query.data ?? null
  const error = query.isError ? query.error.message : null
  // `isPending`: todavía no hay ningún dato (primera carga).
  const primeraCarga = query.isPending
  // `isPlaceholderData`: se está mostrando la página anterior mientras llega la nueva.
  const cargando = query.isPlaceholderData

  /** Props comunes de un campo de filtro: valor de la URL y escritura sin llenar el historial. */
  const textFilter = (name) => ({
    value: filterValue(name),
    onChange: (valor) => setFilter(name, valor, { replace: true }),
  })
  // Ambientes, superficie y año: el backend los recibe como Integer.
  const intFilter = (name) => ({ ...textFilter(name), min: 0, allowDecimal: false, allowNegative: false })
  const selectFilter = (name) => ({
    value: filterValue(name) || null,
    onChange: (valor) => setFilter(name, valor),
    clearable: true,
  })

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconBuildingEstate size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Propiedades
            </Title>
            <Text c="dimmed">
              {data
                ? `${data.totalElements} ${data.totalElements === 1 ? 'propiedad' : 'propiedades'}${
                    filtrando ? ' con estos filtros' : ''
                  }`
                : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/propiedades/nueva" leftSection={<IconPlus size={16} />}>
          Publicar propiedad
        </Button>
      </Group>

      <Group mb="md" justify="space-between">
        <SegmentedControl
          value={active}
          onChange={(valor) => setFilter('active', valor)}
          data={[
            { value: 'true', label: 'Publicadas' },
            { value: 'false', label: 'Dadas de baja' },
          ]}
        />
        {!verArchivadas && (
          <Group gap="xs">
            {filtrando && (
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconFilterOff size={16} />}
                onClick={() => clearFilters(PROPERTY_SEARCH_FILTERS)}
              >
                Limpiar filtros
              </Button>
            )}
            <Button
              variant={masFiltros ? 'light' : 'default'}
              leftSection={<IconAdjustmentsHorizontal size={16} />}
              onClick={() => setMasFiltros((abierto) => !abierto)}
            >
              Más filtros
            </Button>
          </Group>
        )}
      </Group>

      {/* Los de texto son parciales y sin acentos: "cord" encuentra "Córdoba". */}
      {!verArchivadas && (
        <Card withBorder radius="lg" shadow="xs" mb="md">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            <FilterInput label="Ciudad" placeholder="Cualquiera" {...textFilter('city')} />
            <Select label="Tipo" placeholder="Todos" data={PROPERTY_TYPE_OPTIONS} {...selectFilter('type')} />
            <Select
              label="Condición"
              placeholder="Todas"
              data={PROPERTY_CONDITION_OPTIONS}
              {...selectFilter('condition')}
            />
            <FilterInput number label="Ambientes" placeholder="Cualquiera" {...intFilter('rooms')} />
          </SimpleGrid>

          <Collapse expanded={masFiltros}>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} mt="md">
              <FilterInput label="Partido" placeholder="Cualquiera" {...textFilter('county')} />
              <FilterInput label="Provincia" placeholder="Cualquiera" {...textFilter('province')} />
              <Select
                label="Ocupación"
                placeholder="Todas"
                data={PROPERTY_OCCUPANCY_OPTIONS}
                {...selectFilter('occupancy')}
              />
              <FilterInput number label="Superficie desde" suffix=" m²" {...intFilter('minSize')} />
              <FilterInput number label="Superficie hasta" suffix=" m²" {...intFilter('maxSize')} />
              <FilterInput number label="Año desde" {...intFilter('minYear')} />
              <FilterInput number label="Año hasta" {...intFilter('maxYear')} />
            </SimpleGrid>
          </Collapse>
        </Card>
      )}

      {primeraCarga && (
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
              <IconBuildingEstate size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {verArchivadas
                ? 'No hay propiedades dadas de baja'
                : filtrando
                  ? 'Ninguna propiedad coincide con los filtros'
                  : 'Todavía no hay propiedades'}
            </Text>
            {filtrando && (
              <Button mt="md" variant="light" onClick={() => clearFilters(PROPERTY_SEARCH_FILTERS)}>
                Limpiar filtros
              </Button>
            )}
            {!verArchivadas && !filtrando && (
              <Button component={Link} to="/dashboard/propiedades/nueva" mt="md" variant="light">
                Publicar la primera
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {data?.content.length > 0 && (
        <>
          {/* Mientras llega la página nueva, la anterior se ve más transparente. */}
          <Card
            withBorder
            radius="lg"
            padding={0}
            shadow="xs"
            style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            {/* En pantallas angostas la tabla se desplaza de costado en vez de apretarse. */}
            <Table.ScrollContainer minWidth={860}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Dirección</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Condición</Table.Th>
                    <Table.Th>Precio</Table.Th>
                    <Table.Th ta="right">Ambientes</Table.Th>
                    <Table.Th ta="right">Superficie</Table.Th>
                    <Table.Th ta="right">Año</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {/* Una fila por propiedad. `key` con el id: React lo usa para
                      saber qué fila es cuál al cambiar de página. */}
                  {data.content.map((propiedad) => (
                    <Table.Tr key={propiedad.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          {/* La portada es la foto con menor `position`. `?.` evita un
                              error si no hay fotos; en ese caso se ve el ícono. */}
                          <Avatar
                            src={sortPhotos(propiedad.photos)[0]?.url}
                            radius="md"
                            size={40}
                            color="gray"
                          >
                            <IconBuildingEstate size={18} />
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500}>
                              {propiedad.address}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatPropertyPlace(propiedad)}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      {/* Los enums llegan en inglés; el mapa los traduce. */}
                      <Table.Td>{PROPERTY_TYPE_LABEL[propiedad.type] ?? propiedad.type}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={PROPERTY_CONDITION_COLOR[propiedad.condition]}>
                          {PROPERTY_CONDITION_LABEL[propiedad.condition] ?? propiedad.condition}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {propiedad.prices?.length > 0 ? (
                          sortPrices(propiedad.prices).map((price) => (
                            <Text key={price.id} size="sm" style={{ whiteSpace: 'nowrap' }}>
                              <Text span size="xs" c="dimmed">
                                {OPERATION_TYPE_LABEL[price.operationType] ?? price.operationType}
                              </Text>{' '}
                              {formatPrice(price)}
                            </Text>
                          ))
                        ) : (
                          <Text size="sm" c="dimmed">
                            Sin precio
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{propiedad.rooms}</Table.Td>
                      <Table.Td ta="right">{propiedad.size} m²</Table.Td>
                      <Table.Td ta="right">{propiedad.year ?? '—'}</Table.Td>
                      <Table.Td>
                        {/* El PUT solo acepta propiedades activas: las dadas de baja no se editan. */}
                        {propiedad.active !== false && (
                          <ActionIcon
                            component={Link}
                            to={`/dashboard/propiedades/${propiedad.id}/editar`}
                            variant="subtle"
                            aria-label={`Editar ${propiedad.address}`}
                          >
                            <IconPencil size={18} />
                          </ActionIcon>
                        )}
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
