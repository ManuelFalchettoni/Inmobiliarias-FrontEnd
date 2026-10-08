import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Pagination,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconBuildingEstate, IconPencil, IconPlus } from '@tabler/icons-react'

import { queryKeys } from '../../../queries/keys.js'
import {
  OPERATION_TYPE_LABEL,
  PROPERTY_CONDITION_COLOR,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_TYPE_LABEL,
  formatPrice,
  formatPropertyPlace,
  listProperties,
  sortPhotos,
  sortPrices,
} from '../../../services/properties.js'

const PAGE_SIZE = 20

/**
 * Listado de propiedades (`/dashboard/propiedades`). Es el modelo que siguen
 * todos los listados del panel: página y filtros en la URL, un `useQuery` que
 * pide los datos y una tabla que no "parpadea" al cambiar de página.
 */
export default function PropertyList() {
  // La página y los filtros viven en la URL: el listado queda compartible y
  // sumar filtros nuevos no obliga a declarar más estado.
  // useSearchParams lee y escribe la parte `?page=2&active=false` de la dirección.
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1) // 1-based, como lo ve el usuario
  const active = searchParams.get('active') ?? 'true'

  const params = { page: page - 1, size: PAGE_SIZE, active } // Spring cuenta desde 0

  // useQuery pide la página y la guarda en la caché con la clave
  // ['properties', 'list', params]. Cuando cambian la página o el filtro, cambia
  // la clave y React Query pide la nueva; si ya la tenía (volver a la página 1),
  // la muestra al instante. También cancela el pedido viejo con el `signal`.
  const query = useQuery({
    queryKey: queryKeys.properties.list(params),
    queryFn: ({ signal }) => listProperties(params, { signal }),
    // Mientras llega la página nueva se sigue mostrando la anterior: si no, la
    // tabla y el paginador desaparecen en cada clic y el usuario pierde el lugar.
    placeholderData: keepPreviousData,
  })

  /** Al cambiar un filtro hay que volver a la página 1, o queda una lista vacía. */
  const setFiltro = (nombre, valor) => {
    // Se copian los parámetros actuales para no perder los otros filtros.
    const next = new URLSearchParams(searchParams)
    next.set(nombre, valor)
    next.delete('page')
    setSearchParams(next)
  }

  const irAPagina = (nuevaPagina) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nuevaPagina))
    setSearchParams(next)
  }

  const data = query.data ?? null
  const error = query.isError ? query.error.message : null
  // `isPending`: todavía no hay ningún dato (primera carga).
  const primeraCarga = query.isPending
  // `isPlaceholderData`: se está mostrando la página anterior mientras llega la nueva.
  const cargando = query.isPlaceholderData
  const verArchivadas = active === 'false'

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
                ? `${data.totalElements} ${data.totalElements === 1 ? 'propiedad' : 'propiedades'}`
                : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/propiedades/nueva" leftSection={<IconPlus size={16} />}>
          Publicar propiedad
        </Button>
      </Group>

      <SegmentedControl
        mb="md"
        value={active}
        onChange={(valor) => setFiltro('active', valor)}
        data={[
          { value: 'true', label: 'Publicadas' },
          { value: 'false', label: 'Dadas de baja' },
        ]}
      />

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
              {verArchivadas ? 'No hay propiedades dadas de baja' : 'Todavía no hay propiedades'}
            </Text>
            {!verArchivadas && (
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
              <Pagination total={data.totalPages} value={page} onChange={irAPagina} />
            </Group>
          )}
        </>
      )}
    </Container>
  )
}
