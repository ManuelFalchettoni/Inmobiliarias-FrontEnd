import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Pagination,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconArrowBackUp, IconCircleCheck } from '@tabler/icons-react'

import { queryKeys } from '../../../queries/keys.js'
import { formatDate } from '../../../services/format.js'

const PAGE_SIZE = 10

/**
 * Un cajón del acordeón de Archivados: la tabla de "dados de baja" de un
 * recurso (propiedades, agencias o usuarios) con su botón Restaurar. Las tres
 * secciones de Archivados son esta misma
 * pieza con distinta configuración: qué pedir, cómo restaurar y qué columnas.
 *
 * @param {object} props
 * @param {'properties' | 'agencies' | 'users'} props.resource nombre en queryKeys
 * @param {(params, options) => Promise} props.list el `listX` del servicio
 * @param {(id, options) => Promise} props.restore el `restoreX` del servicio
 * @param {Array<{ label: string, render: (row) => React.ReactNode }>} props.columns
 * @param {(row) => string} props.nameOf cómo se nombra una fila en los avisos
 * @param {(row) => { to: string, label: string }} props.linkAfterRestore a dónde ir después de restaurar
 * @param {string} props.allPath el listado completo del recurso, en su pestaña de dados de baja
 */
export default function ArchivedSection({
  resource,
  title,
  icon: Icon,
  emptyText,
  // Singular y plural para el contador: las propiedades se "archivan", lo demás se "da de baja".
  countWords = ['dado de baja', 'dados de baja'],
  list,
  restore,
  columns,
  nameOf,
  linkAfterRestore,
  allPath,
}) {
  // La página de esta sección vive en un estado propio y no en la URL: en la
  // misma pantalla hay tres paginadores, y con uno solo en la URL se pisarían.
  const [page, setPage] = useState(1)
  // Lo más reciente primero: lo último que se dio de baja queda arriba.
  const params = { page: page - 1, size: PAGE_SIZE, sort: 'updatedAt,desc', active: false }

  // Misma clave que el listado de cada recurso con `active=false`: invalidar
  // ['properties'] (por ejemplo, al archivar desde la edición) refresca esta tabla.
  const query = useQuery({
    queryKey: queryKeys[resource].list(params),
    queryFn: ({ signal }) => list(params, { signal }),
    placeholderData: keepPreviousData,
  })

  const queryClient = useQueryClient()
  const action = useMutation({
    mutationFn: (row) => restore(row.id),
    // Todo el recurso: esta tabla, el listado de activos y el total del menú.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys[resource].all }),
  })
  const busyId = action.isPending ? action.variables.id : null
  const restored = action.isSuccess ? action.variables : null

  const data = query.data ?? null
  const rows = data?.content ?? []
  const total = data?.totalElements ?? 0

  // Si se restauró el último de una página que no es la primera, la página
  // queda vacía: se vuelve a la anterior.
  if (data && rows.length === 0 && page > 1) setPage(page - 1)

  return (
    // Un "cajón" del acordeón (ver ArchiveList). `value` lo identifica: el
    // acordeón guarda la lista de los abiertos, por ejemplo ['properties', 'users'].
    <Accordion.Item value={resource}>
      {/* La barra que se toca para abrir o cerrar. El contador queda a la vista
          aunque esté cerrado: se sabe qué hay sin abrirlo. */}
      <Accordion.Control
        icon={
          <ThemeIcon variant="light" size={40} radius="md">
            <Icon size={22} />
          </ThemeIcon>
        }
      >
        <Title order={2} size="h4">
          {title}
        </Title>
        <Text size="sm" c="dimmed">
          {query.isPending ? 'Cargando...' : `${total} ${total === 1 ? countWords[0] : countWords[1]}`}
        </Text>
      </Accordion.Control>

      {/* El contenido. Cerrado se oculta pero sigue montado: el contador de
          arriba se mantiene al día y al reabrir no se vuelve a pedir nada. */}
      <Accordion.Panel>
        {/* El link va acá y no en la barra: un link dentro de un botón no se
            puede tocar sin abrir o cerrar el cajón. */}
        {total > 0 && (
          <Group justify="flex-end" mb="sm">
            <Anchor component={Link} to={allPath} size="sm" fw={500}>
              Ver en su listado
            </Anchor>
          </Group>
        )}

        {query.isError && (
          <Alert color="danger" icon={<IconAlertTriangle />} mb="md">
            {query.error.message}
          </Alert>
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
            {nameOf(action.variables)}: {action.error.message}
          </Alert>
        )}

        {restored && (
          <Alert color="pine" icon={<IconCircleCheck />} mb="md" withCloseButton onClose={action.reset}>
            <Group gap="sm" justify="space-between">
              <Text size="sm">Restauraste {nameOf(restored)}. Volvió a los activos.</Text>
              <Button size="compact-sm" variant="white" component={Link} to={linkAfterRestore(restored).to}>
                {linkAfterRestore(restored).label}
              </Button>
            </Group>
          </Alert>
        )}

        {query.isPending ? (
          <Stack gap="xs">
            <Skeleton height={36} radius="sm" />
            <Skeleton height={36} radius="sm" />
            <Skeleton height={36} radius="sm" />
          </Stack>
        ) : rows.length === 0 ? (
          !query.isError && (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              {emptyText}
            </Text>
          )
        ) : (
          <>
            {/* `ScrollContainer`: en pantallas angostas la tabla se desplaza de
                costado en vez de desbordar la tarjeta. */}
            <Table.ScrollContainer minWidth={560}>
              <Table verticalSpacing="sm" style={{ opacity: query.isPlaceholderData ? 0.55 : 1 }}>
                <Table.Thead>
                  <Table.Tr>
                    {columns.map((column) => (
                      <Table.Th key={column.label}>{column.label}</Table.Th>
                    ))}
                    <Table.Th>Desde</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => (
                    <Table.Tr key={row.id}>
                      {columns.map((column) => (
                        <Table.Td key={column.label}>{column.render(row)}</Table.Td>
                      ))}
                      {/* La baja es lógica: la última modificación es, casi
                          siempre, el momento en que se dio de baja. */}
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {row.updatedAt ? formatDate(row.updatedAt) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button
                          size="compact-sm"
                          variant="light"
                          leftSection={<IconArrowBackUp size={14} />}
                          loading={busyId === row.id}
                          disabled={action.isPending && busyId !== row.id}
                          onClick={() => action.mutate(row)}
                          aria-label={`Restaurar ${nameOf(row)}`}
                        >
                          Restaurar
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {data.totalPages > 1 && (
              <Group justify="flex-end" mt="md">
                <Pagination size="sm" total={data.totalPages} value={page} onChange={setPage} />
              </Group>
            )}
          </>
        )}
      </Accordion.Panel>
    </Accordion.Item>
  )
}

/** Un Badge chico, para el tipo, el rol o el estado de cada fila. */
export function RowBadge({ color, children }) {
  return (
    <Badge variant="light" size="sm" color={color}>
      {children}
    </Badge>
  )
}
