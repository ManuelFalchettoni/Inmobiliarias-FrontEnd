import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Alert,
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
import { IconAlertTriangle, IconBuildingEstate, IconPlus } from '@tabler/icons-react'

import {
  PROPERTY_CONDITION_COLOR,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_TYPE_LABEL,
  listProperties,
} from '../../../services/properties.js'

const PAGE_SIZE = 20

export default function PropertyList() {
  // La página y los filtros viven en la URL: el listado queda compartible y
  // sumar filtros nuevos no obliga a declarar más estado.
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1) // 1-based, como lo ve el usuario
  const active = searchParams.get('active') ?? 'true'

  // Identifica el pedido en curso. El resultado guarda la clave con la que se
  // trajo, así "estoy cargando" se deduce comparando: no hace falta un estado
  // aparte ni un setState dentro del efecto.
  const clave = `${page}|${active}`
  const [resultado, setResultado] = useState(null) // { clave, data, error }
  const cargando = resultado?.clave !== clave

  useEffect(() => {
    const controller = new AbortController()

    listProperties(
      { page: page - 1, size: PAGE_SIZE, active }, // Spring cuenta desde 0
      { signal: controller.signal },
    )
      .then((pagina) => {
        if (controller.signal.aborted) return
        setResultado({ clave, data: pagina, error: null })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setResultado({ clave, data: null, error: err.message })
      })

    // Cancela el pedido anterior antes de lanzar el nuevo, para que una
    // respuesta lenta no pise a una más reciente.
    return () => controller.abort()
  }, [clave, page, active])

  /** Al cambiar un filtro hay que volver a la página 1, o queda una lista vacía. */
  const setFiltro = (nombre, valor) => {
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

  // Se sigue mostrando el resultado anterior mientras llega el nuevo: si no, la
  // tabla y el paginador desaparecen en cada clic y el usuario pierde el lugar.
  const data = resultado?.data ?? null
  const error = resultado?.error ?? null
  const primeraCarga = cargando && resultado == null
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
          <Card
            withBorder
            radius="lg"
            padding={0}
            shadow="xs"
            style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Dirección</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Condición</Table.Th>
                    <Table.Th ta="right">Ambientes</Table.Th>
                    <Table.Th ta="right">Superficie</Table.Th>
                    <Table.Th ta="right">Año</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.content.map((propiedad) => (
                    <Table.Tr key={propiedad.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {propiedad.address}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {propiedad.location}
                        </Text>
                      </Table.Td>
                      {/* Los enums llegan en inglés; el mapa los traduce. */}
                      <Table.Td>{PROPERTY_TYPE_LABEL[propiedad.type] ?? propiedad.type}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={PROPERTY_CONDITION_COLOR[propiedad.condition]}>
                          {PROPERTY_CONDITION_LABEL[propiedad.condition] ?? propiedad.condition}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">{propiedad.rooms}</Table.Td>
                      <Table.Td ta="right">{propiedad.size} m²</Table.Td>
                      <Table.Td ta="right">{propiedad.year ?? '—'}</Table.Td>
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
