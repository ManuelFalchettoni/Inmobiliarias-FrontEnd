import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Anchor, Badge, Button, Card, Group, Pagination, Skeleton, Stack, Table, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconArrowBackUp, IconCircleCheck } from '@tabler/icons-react'

import { queryKeys } from '../../../queries/keys.js'
import { formatDate } from '../../../services/format.js'
import { archivedParams } from './archived-params.js'

/**
 * Una sección de Archivados: la tabla de "dados de baja" de un recurso
 * (propiedades, agencias o usuarios) con su botón Restaurar. Las tres secciones
 * son esta misma pieza con distinta configuración: qué pedir, cómo restaurar y
 * qué columnas.
 *
 * Sin nada dado de baja, la sección se achica a una línea: así no ocupa lo
 * mismo que las que tienen algo para restaurar.
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
  // false oculta el botón Restaurar: el rol no puede restaurar este recurso.
  canRestore = true,
}) {
  // La página de esta sección vive en un estado propio y no en la URL: en la
  // misma pantalla hay tres paginadores, y con uno solo en la URL se pisarían.
  const [page, setPage] = useState(1)
  const params = archivedParams(page - 1)

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
  const empty = !query.isPending && !query.isError && rows.length === 0

  // Si se restauró el último de una página que no es la primera, la página
  // queda vacía: se vuelve a la anterior.
  if (data && rows.length === 0 && page > 1) setPage(page - 1)

  const headingId = `archived-${resource}`

  return (
    <section aria-labelledby={headingId}>
      <Group justify="space-between" align="center" mb="sm" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Icon size={20} stroke={1.6} color="var(--app-muted)" aria-hidden />
          <Title id={headingId} order={2} size="h4">
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {query.isPending ? 'Cargando...' : `${total} ${total === 1 ? countWords[0] : countWords[1]}`}
          </Text>
        </Group>
        {total > 0 && (
          <Anchor component={Link} to={allPath} size="sm" fw={500}>
            Ver en su listado
          </Anchor>
        )}
      </Group>

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
          <Skeleton height={44} radius="md" />
          <Skeleton height={44} radius="md" />
        </Stack>
      ) : empty ? (
        <Card variant="empty" radius="lg" padding="md">
          <Text size="sm" c="dimmed">
            {emptyText}
          </Text>
        </Card>
      ) : (
        rows.length > 0 && (
          <>
            <Card
              variant="table"
              radius="lg"
              padding={0}
              style={{ opacity: query.isPlaceholderData ? 0.55 : 1, transition: 'opacity 150ms' }}
            >
              {/* En pantallas angostas la tabla se desplaza de costado en vez de desbordar. */}
              <Table.ScrollContainer minWidth={620}>
                <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {columns.map((column) => (
                        <Table.Th key={column.label}>{column.label}</Table.Th>
                      ))}
                      <Table.Th>De baja desde</Table.Th>
                      {canRestore && <Table.Th w={1} />}
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
                        {canRestore && (
                          <Table.Td ta="right">
                            <Button
                              size="compact-sm"
                              variant="default"
                              leftSection={<IconArrowBackUp size={14} />}
                              loading={busyId === row.id}
                              disabled={action.isPending && busyId !== row.id}
                              onClick={() => action.mutate(row)}
                              aria-label={`Restaurar ${nameOf(row)}`}
                            >
                              Restaurar
                            </Button>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>

            {data.totalPages > 1 && (
              <Group justify="flex-end" mt="md">
                <Pagination size="sm" total={data.totalPages} value={page} onChange={setPage} />
              </Group>
            )}
          </>
        )
      )}
    </section>
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
