import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Container,
  Group,
  MultiSelect,
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
  Tooltip,
} from '@mantine/core'
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowBackUp,
  IconBuildingEstate,
  IconCircleCheck,
  IconEye,
  IconFilterOff,
  IconLayoutGrid,
  IconList,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react'

import FilterInput from '../../../components/FilterInput.jsx'
import { useAuth } from '../../../context/auth-context.js'
import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { queryKeys } from '../../../queries/keys.js'
import {
  CURRENCY_OPTIONS,
  DEFAULT_PROPERTY_SORT,
  OPERATION_TYPE_LABEL,
  OPERATION_TYPE_OPTIONS,
  PRICE_FILTERS,
  PROPERTY_CONDITION_COLOR,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_CONDITION_OPTIONS,
  PROPERTY_OCCUPANCY_OPTIONS,
  PROPERTY_SEARCH_FILTERS,
  PROPERTY_SEARCH_RANGES,
  PROPERTY_SORT_OPTIONS,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPE_OPTIONS,
  formatPrice,
  formatPropertyPlace,
  listProperties,
  restoreProperty,
  searchProperties,
  sortPhotos,
  sortPrices,
} from '../../../services/properties.js'
import PropertyCards from './PropertyCards.jsx'

const PAGE_SIZE = 20

/** Los filtros que se ven siempre. El resto va en "Más filtros". */
const MAIN_FILTERS = ['city', 'type', 'operationType', 'minRooms']

/** Los filtros que van en "Más filtros": si alguno tiene valor, el panel arranca abierto. */
const EXTRA_FILTERS = PROPERTY_SEARCH_FILTERS.filter((name) => !MAIN_FILTERS.includes(name))

/**
 * Saca de los filtros los que el backend rechazaría con un 400 y devuelve, por
 * campo, el motivo para mostrarlo debajo. Así un "desde" mayor que el "hasta"
 * marca el campo en vez de reemplazar el listado por un cartel de error.
 */
function validateFilters(filters) {
  const valid = { ...filters }
  const errors = {}

  for (const [min, max] of PROPERTY_SEARCH_RANGES) {
    if (min in valid && max in valid && Number(valid[min]) > Number(valid[max])) {
      errors[max] = 'Es menor que el "desde"'
      delete valid[min]
      delete valid[max]
    }
  }

  if (!valid.currency && PRICE_FILTERS.some((name) => name in valid)) {
    errors.currency = 'Elegí la moneda para filtrar por precio'
    for (const name of PRICE_FILTERS) delete valid[name]
  }

  return { valid, errors }
}

/** Texto del selector de vista con su ícono. */
const ViewLabel = ({ icon: Icon, text }) => (
  <Group gap={6} wrap="nowrap">
    <Icon size={16} />
    <span>{text}</span>
  </Group>
)

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
  // Elegir inmobiliaria es solo del admin (sin elegir, ve todas). AGENCY y AGENT
  // ven siempre la suya: el backend ignora el `agencyId` que manden.
  const { isAdmin } = useAuth()
  const agencyId = isAdmin ? (searchParams.get('agencyId') ?? null) : null
  const agencyOptions = useAgencyOptions(agencyId)

  // La búsqueda del backend solo trae activas: con "Archivadas" los
  // filtros no se muestran ni se mandan (quedan en la URL para cuando se vuelva).
  const urlFilters = verArchivadas ? {} : pick(PROPERTY_SEARCH_FILTERS)
  const { valid: filters, errors: filterErrors } = validateFilters(urlFilters)
  const filtrando = Object.keys(filters).length > 0
  const hayFiltros = Object.keys(urlFilters).length > 0
  const filterValue = (name) => searchParams.get(name) ?? ''

  // Ordenar por precio es ordenar por UN precio: el de la operación y la moneda
  // elegidas. Sin las dos, se pide el orden de siempre (el backend daría 400).
  const puedeOrdenarPorPrecio = Boolean(filters.operationType && filters.currency)
  const pedido = searchParams.get('sort')
  const sort =
    PROPERTY_SORT_OPTIONS.some((o) => o.value === pedido) && (puedeOrdenarPorPrecio || !pedido.startsWith('price,'))
      ? pedido
      : DEFAULT_PROPERTY_SORT
  const sortOptions = PROPERTY_SORT_OPTIONS.map((o) => ({
    ...o,
    disabled: o.value.startsWith('price,') && !puedeOrdenarPorPrecio,
  }))

  const [masFiltros, setMasFiltros] = useState(() => EXTRA_FILTERS.some((name) => searchParams.get(name)))

  // Spring cuenta desde 0. Con algún filtro se usa /search, sin filtros el
  // listado de siempre: la clave decide sola a qué endpoint se pide. Los dos
  // aceptan `agencyId` (sin valor no viaja, ver pageQuery). El orden por precio
  // solo es posible con filtros, así que sin ellos `sort` siempre es el de siempre.
  const params = filtrando
    ? { page: page - 1, size: PAGE_SIZE, sort, agencyId, ...filters }
    : { page: page - 1, size: PAGE_SIZE, active, agencyId }

  // useQuery pide la página y la guarda en la caché con la clave
  // ['properties', 'list', params]. Cuando cambian la página o el filtro, cambia
  // la clave y React Query pide la nueva; si ya la tenía (volver a la página 1),
  // la muestra al instante. También cancela el pedido viejo con el `signal`.
  const listKey = queryKeys.properties.list(params)
  const query = useQuery({
    queryKey: listKey,
    queryFn: ({ signal }) => (filtrando ? searchProperties : listProperties)(params, { signal }),
    // Mientras llega la página nueva se sigue mostrando la anterior: si no, la
    // tabla y el paginador desaparecen en cada clic y el usuario pierde el lugar.
    placeholderData: keepPreviousData,
  })

  /**
   * Restaurar. Saca la propiedad de la lista actual: se la quita de la página
   * en caché apenas responde el backend (sin esperar el GET nuevo) y después se
   * invalida todo ['properties'] para traer la página real, el total del menú y
   * la otra pestaña. `listKey` viaja en las variables para tocar la página
   * donde se hizo clic, no la que se vea cuando llegue la respuesta.
   *
   * Archivar no está acá: se hace solo desde la edición de la propiedad, que
   * vuelve a este listado con `state.archived` (ver PropertyForm).
   */
  const queryClient = useQueryClient()
  const action = useMutation({
    mutationFn: ({ property }) => restoreProperty(property.id),
    onSuccess: (_, { property, listKey: key }) => {
      queryClient.setQueryData(key, (old) =>
        old && {
          ...old,
          content: old.content.filter((p) => p.id !== property.id),
          totalElements: old.totalElements - 1,
        },
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.properties.all }),
  })
  const restore = (property) => action.mutate({ property, listKey })
  const busyId = action.isPending ? action.variables.property.id : null

  // La propiedad que se acaba de archivar en la edición. El `state` de la
  // navegación viaja en el historial del navegador, así que se copia a un
  // estado propio y se borra del historial: recargar la página no repite el aviso.
  const location = useLocation()
  const navigate = useNavigate()
  const [archivadaRecien, setArchivadaRecien] = useState(() => location.state?.archived ?? null)
  useEffect(() => {
    if (location.state?.archived) navigate({ search: location.search }, { replace: true, state: null })
  }, [location.state, location.search, navigate])

  // El aviso de arriba del listado: lo último que se restauró o, si no, lo que
  // se archivó en la edición (con "Deshacer", que lo restaura acá mismo).
  const hecho = action.isSuccess
    ? { property: action.variables.property, archive: false }
    : archivadaRecien && { property: archivadaRecien, archive: true }
  const cerrarAviso = () => {
    action.reset()
    setArchivadaRecien(null)
  }

  const data = query.data ?? null
  const error = query.isError ? query.error.message : null
  // `isPending`: todavía no hay ningún dato (primera carga).
  const primeraCarga = query.isPending
  // `isPlaceholderData`: se está mostrando la página anterior mientras llega la nueva.
  const cargando = query.isPlaceholderData
  // Fichas es la vista de siempre; la tabla queda en la URL (`?vista=tabla`).
  const vista = searchParams.get('vista') === 'tabla' ? 'tabla' : 'fichas'

  /** Props comunes de un campo de filtro: valor de la URL y escritura sin llenar el historial. */
  const textFilter = (name) => ({
    value: filterValue(name),
    onChange: (valor) => setFilter(name, valor, { replace: true }),
    error: filterErrors[name],
  })
  // Ambientes, piso, superficie y año: el backend los recibe como Integer.
  const intFilter = (name) => ({ ...textFilter(name), min: 0, allowDecimal: false, allowNegative: false })
  // Precio: BigDecimal con centavos, escrito como 95.000,50.
  const priceFilter = (name) => ({
    ...textFilter(name),
    min: 0,
    decimalScale: 2,
    decimalSeparator: ',',
    thousandSeparator: '.',
    allowNegative: false,
  })
  const selectFilter = (name) => ({
    value: filterValue(name) || null,
    onChange: (valor) => setFilter(name, valor),
    clearable: true,
    error: filterErrors[name],
  })
  // Varios valores en un solo parámetro de la URL, separados por coma
  // (`type=HOUSE,PH`): el backend acepta esa misma forma.
  const multiFilter = (name) => ({
    value: filterValue(name) ? filterValue(name).split(',') : [],
    onChange: (valores) => setFilter(name, valores.join(',')),
    clearable: true,
  })

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
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

        <Button component={Link} to="/dashboard/propiedades/nueva" leftSection={<IconPlus size={16} />}>
          Publicar propiedad
        </Button>
      </Group>

      <Group mb="md" justify="space-between">
        <Group gap="md">
          <SegmentedControl
            value={active}
            onChange={(valor) => setFilter('active', valor)}
            data={[
              { value: 'true', label: 'Activas' },
              { value: 'false', label: 'Archivadas' },
            ]}
          />
          {isAdmin && (
            <Select
              w={280}
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
        </Group>
        <Group gap="xs">
          {!verArchivadas && hayFiltros && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} />}
              onClick={() => clearFilters([...PROPERTY_SEARCH_FILTERS, 'sort'])}
            >
              Limpiar filtros
            </Button>
          )}
          {!verArchivadas && (
            <Tooltip
              label="Para ordenar por precio, elegí operación y moneda"
              withArrow
              disabled={puedeOrdenarPorPrecio}
            >
              <Select
                w={210}
                aria-label="Orden"
                data={sortOptions}
                value={sort}
                onChange={(valor) => setFilter('sort', valor === DEFAULT_PROPERTY_SORT ? null : valor)}
                allowDeselect={false}
              />
            </Tooltip>
          )}
          {!verArchivadas && (
            <Button
              variant={masFiltros ? 'light' : 'default'}
              leftSection={<IconAdjustmentsHorizontal size={16} />}
              onClick={() => setMasFiltros((abierto) => !abierto)}
            >
              Más filtros
            </Button>
          )}
          {/* Cómo se ve la lista, no qué trae: cambiarla no vuelve a la página 1. */}
          <SegmentedControl
            aria-label="Vista del listado"
            value={vista}
            onChange={(valor) => setFilter('vista', valor === 'tabla' ? 'tabla' : null, { keepPage: true })}
            data={[
              { value: 'fichas', label: <ViewLabel icon={IconLayoutGrid} text="Fichas" /> },
              { value: 'tabla', label: <ViewLabel icon={IconList} text="Tabla" /> },
            ]}
          />
        </Group>
      </Group>

      {/* Los de texto son parciales y sin acentos: "cord" encuentra "Córdoba". */}
      {!verArchivadas && (
        <Box mb="lg">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            <FilterInput label="Ciudad" placeholder="Cualquiera" {...textFilter('city')} />
            <MultiSelect
              label="Tipo"
              placeholder={filterValue('type') ? undefined : 'Todos'}
              data={PROPERTY_TYPE_OPTIONS}
              {...multiFilter('type')}
            />
            <Select
              label="Operación"
              placeholder="Venta o alquiler"
              data={OPERATION_TYPE_OPTIONS}
              {...selectFilter('operationType')}
            />
            <FilterInput number label="Ambientes desde" placeholder="Cualquiera" {...intFilter('minRooms')} />
          </SimpleGrid>

          <Collapse expanded={masFiltros}>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} mt="md">
              {/* El precio que se filtra es el de la operación elegida arriba. */}
              <Select label="Moneda" placeholder="Cualquiera" data={CURRENCY_OPTIONS} {...selectFilter('currency')} />
              <FilterInput number label="Precio desde" {...priceFilter('minPrice')} />
              <FilterInput number label="Precio hasta" {...priceFilter('maxPrice')} />
              <FilterInput number label="Ambientes hasta" placeholder="Cualquiera" {...intFilter('maxRooms')} />
              <FilterInput label="Dirección" placeholder="Cualquiera" {...textFilter('address')} />
              <FilterInput label="Partido" placeholder="Cualquiera" {...textFilter('county')} />
              <FilterInput label="Provincia" placeholder="Cualquiera" {...textFilter('province')} />
              <MultiSelect
                label="Condición"
                placeholder={filterValue('condition') ? undefined : 'Todas'}
                data={PROPERTY_CONDITION_OPTIONS}
                {...multiFilter('condition')}
              />
              <MultiSelect
                label="Ocupación"
                placeholder={filterValue('occupancy') ? undefined : 'Todas'}
                data={PROPERTY_OCCUPANCY_OPTIONS}
                {...multiFilter('occupancy')}
              />
              {/* Con piso, las propiedades sin piso cargado (casas, terrenos) quedan afuera. */}
              <FilterInput number label="Piso desde" {...intFilter('minFloor')} />
              <FilterInput number label="Piso hasta" {...intFilter('maxFloor')} />
              <FilterInput number label="Superficie desde" suffix=" m²" {...intFilter('minSize')} />
              <FilterInput number label="Superficie hasta" suffix=" m²" {...intFilter('maxSize')} />
              <FilterInput number label="Año desde" {...intFilter('minYear')} />
              <FilterInput number label="Año hasta" {...intFilter('maxYear')} />
            </SimpleGrid>
          </Collapse>
        </Box>
      )}

      {action.isError && (
        <Alert
          color="danger"
          icon={<IconAlertTriangle />}
          title="No se pudo restaurar"
          mb="md"
          withCloseButton
          onClose={action.reset}
        >
          {action.variables.property.address}: {action.error.message}
        </Alert>
      )}

      {hecho && (
        <Alert color="pine" icon={<IconCircleCheck />} mb="md" withCloseButton onClose={cerrarAviso}>
          <Group gap="sm" justify="space-between">
            <Text size="sm">
              {hecho.archive
                ? `Archivaste ${hecho.property.address}. Ya no aparece en búsquedas ni se puede editar.`
                : `Restauraste ${hecho.property.address}. Volvió a las activas.`}
            </Text>
            {/* Deshacer restaura acá mismo; después de restaurar, se ofrece abrir la ficha. */}
            {hecho.archive ? (
              <Group gap="xs" wrap="nowrap">
                {/* Lleva a la pestaña Archivadas (`?active=false`), donde quedó la
                    propiedad. Ya estando ahí, el botón no hace falta. */}
                {!verArchivadas && (
                  <Button size="compact-sm" variant="white" onClick={() => setFilter('active', 'false')}>
                    Ver archivadas
                  </Button>
                )}
                <Button
                  size="compact-sm"
                  variant="white"
                  leftSection={<IconArrowBackUp size={16} />}
                  loading={busyId === hecho.property.id}
                  onClick={() => restore(hecho.property)}
                >
                  Deshacer
                </Button>
              </Group>
            ) : (
              <Button size="compact-sm" variant="white" component={Link} to={`/propiedades/${hecho.property.id}`}>
                Ver ficha
              </Button>
            )}
          </Group>
        </Alert>
      )}

      {primeraCarga && (
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
              <IconBuildingEstate size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {verArchivadas
                ? 'No hay propiedades archivadas'
                : filtrando
                  ? 'Ninguna propiedad coincide con los filtros'
                  : 'Todavía no hay propiedades'}
            </Text>
            {filtrando && (
              <Button mt="md" variant="light" onClick={() => clearFilters([...PROPERTY_SEARCH_FILTERS, 'sort'])}>
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

      {data?.content.length > 0 && vista === 'fichas' && (
        <div style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}>
          <PropertyCards properties={data.content} busyId={busyId} onRestore={restore} />
        </div>
      )}

      {data?.content.length > 0 && vista === 'tabla' && (
        // Mientras llega la página nueva, la anterior se ve más transparente.
        <Card
          variant="table"
          radius="lg"
          padding={0}
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
                          {/* La dirección abre la ficha, salvo en las archivadas: no se pueden traer. */}
                          {propiedad.active !== false ? (
                            <Anchor
                              component={Link}
                              to={`/propiedades/${propiedad.id}`}
                              size="sm"
                              fw={500}
                              c="var(--mantine-color-text)"
                            >
                              {propiedad.address}
                            </Anchor>
                          ) : (
                            <Text size="sm" fw={500}>
                              {propiedad.address}
                            </Text>
                          )}
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
                      {/* El PUT solo acepta propiedades activas: las archivadas solo se restauran. */}
                      {propiedad.active === false ? (
                        <Button
                          size="compact-sm"
                          variant="light"
                          leftSection={<IconArrowBackUp size={16} />}
                          loading={busyId === propiedad.id}
                          onClick={() => restore(propiedad)}
                          aria-label={`Restaurar ${propiedad.address}`}
                        >
                          Restaurar
                        </Button>
                      ) : (
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Ver ficha" withArrow>
                            <ActionIcon
                              component={Link}
                              to={`/propiedades/${propiedad.id}`}
                              variant="subtle"
                              color="gray"
                              aria-label={`Ver la ficha de ${propiedad.address}`}
                            >
                              <IconEye size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Editar" withArrow>
                            <ActionIcon
                              component={Link}
                              to={`/dashboard/propiedades/${propiedad.id}/editar`}
                              variant="subtle"
                              aria-label={`Editar ${propiedad.address}`}
                            >
                              <IconPencil size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      {data?.totalPages > 1 && (
        <Group justify="center" mt="lg">
          <Pagination total={data.totalPages} value={page} onChange={goToPage} />
        </Group>
      )}
    </Container>
  )
}
