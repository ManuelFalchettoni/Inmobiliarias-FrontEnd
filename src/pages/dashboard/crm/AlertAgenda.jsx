import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Pagination,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconAlertTriangle, IconBellRinging, IconClockHour4 } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { useNow } from '../../../hooks/useNow.js'
import { useUserOptions } from '../../../hooks/useSelectOptions.js'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { queryKeys } from '../../../queries/keys.js'
import {
  AGENDA_BUCKETS,
  AGENDA_SORTS,
  CRM_STAGE_COLOR,
  CRM_STAGE_LABEL,
  fetchAgendaSummary,
  listAgenda,
} from '../../../services/crm.js'
import { formatDateTime, formatTimeLeft } from '../../../services/format.js'
import { findUser } from '../../../services/users.js'

const PAGE_SIZE = 20
// Columnas de la tabla: las filas de grupo ocupan todas.
const COLUMN_COUNT = 6

/** Orden de la agenda. Los vencidos van siempre primero y los sin aviso, al final. */
const SORT_OPTIONS = [
  { value: 'proximo', label: 'Menos tiempo para el aviso' },
  { value: 'lejano', label: 'Más tiempo para el aviso' },
]
const DEFAULT_SORT = AGENDA_SORTS[0]

/**
 * Los tramos de la agenda. El de cada fila lo manda el backend (`bucket`,
 * calculado con su hora); el de los leads sin aviso es `null` y acá se llama
 * `none`. No se pisan: "Próximas 24 horas" no incluye la próxima hora.
 * `empty`: el texto cuando el tramo elegido en el selector no tiene nada.
 */
const BUCKETS = {
  overdue: { label: 'Vencidos', empty: 'No hay avisos vencidos' },
  hour: { label: 'En la próxima hora', empty: 'No hay avisos en la próxima hora' },
  day: { label: 'Próximas 24 horas', empty: 'No hay avisos en las próximas 24 horas' },
  week: { label: 'Próximos 7 días', empty: 'No hay avisos en los próximos 7 días' },
  later: { label: 'Más adelante', empty: 'No hay avisos para más adelante' },
  none: { label: 'Sin avisos pendientes' },
}
const bucketOf = (row) => row.bucket ?? 'none'

/** El selector de tramo (`?cuando=`): "Todos" o uno de los tramos del backend. */
const ALL = 'todos'

/** Una opción del selector de tramo: el nombre y, al lado, cuántos leads tiene. */
function TimeOption({ label, count }) {
  return (
    <Group gap={6} wrap="nowrap" justify="center">
      <span>{label}</span>
      {count != null && (
        <Text component="span" size="xs" c="dimmed" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </Text>
      )}
    </Group>
  )
}

/** "1 lead" / "3 leads". */
const leadsCount = (n) => `${n} ${n === 1 ? 'lead' : 'leads'}`

/**
 * Qué falta para el aviso (o cuánto hace que venció) y, debajo, la fecha. Si
 * está vencido lo dice el backend (`overdue`); la hora del navegador solo se usa
 * para el texto, que se actualiza solo con `useNow`.
 */
function WhenCell({ row, now }) {
  const { nextAlert, overdue } = row
  if (!nextAlert) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    )
  }

  const timeLeft = new Date(nextAlert.alertDate).getTime() - now
  return (
    <>
      <Text
        size="sm"
        fw={600}
        c={overdue ? 'danger' : undefined}
        style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      >
        {overdue
          ? // Al menos 1 ms: justo en el segundo del aviso dice "menos de 1 min".
            `Vencido hace ${formatTimeLeft(Math.max(-timeLeft, 1))}`
          : `En ${formatTimeLeft(Math.max(timeLeft, 1))}`}
      </Text>
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {formatDateTime(nextAlert.alertDate)}
      </Text>
    </>
  )
}

/**
 * La fila que abre un grupo: el nombre y cuántos leads tiene en total (del
 * summary, no solo de esta página). Los vencidos, en rojo.
 */
function GroupRow({ bucket, count }) {
  return (
    <Table.Tr style={{ backgroundColor: 'var(--app-raised)' }}>
      <Table.Td colSpan={COLUMN_COUNT} py={8}>
        <Group gap="xs">
          <Text size="sm" fw={600} c={bucket === 'overdue' ? 'danger' : undefined}>
            {BUCKETS[bucket].label}
          </Text>
          {count != null && (
            <Text size="xs" c="dimmed">
              {leadsCount(count)}
            </Text>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}

/**
 * Agenda de avisos (`/dashboard/avisos`): una fila por lead con su próximo
 * aviso, agrupadas por cuándo.
 *
 * Todo lo arma el backend: `GET /api/crm_alerts/agenda` devuelve la página ya
 * ordenada (vencidos primero, el más atrasado arriba; después el resto según el
 * orden elegido; al final los sin aviso) y `.../agenda/summary` cuántos hay en
 * cada tramo. Las claves cuelgan de ['leads']: completar, editar o borrar un
 * aviso (en el detalle o en la campanita) las vuelve a pedir.
 *
 * Al entrar se ven los vencidos y no los leads sin avisos. Filtros en la URL:
 * `?vencidos=0` oculta los vencidos, `?sinAvisos=1` suma los leads sin avisos,
 * `?cuando=` elige un tramo, `?orden=lejano` invierte el orden y `?userId=` filtra
 * por agente.
 */
export default function AlertAgenda() {
  const navigate = useNavigate()
  const now = useNow()
  const { searchParams, page, setFilter, goToPage } = useUrlFilters()
  const userId = searchParams.get('userId') ?? null
  const sort = AGENDA_SORTS.includes(searchParams.get('orden')) ? searchParams.get('orden') : DEFAULT_SORT
  const showEmpty = searchParams.get('sinAvisos') === '1'
  const showOverdue = searchParams.get('vencidos') !== '0'
  // "Vencidos" no tiene sentido con los vencidos ocultos: ahí se vuelve a "Todos".
  const requestedBucket = searchParams.get('cuando')
  const bucket =
    AGENDA_BUCKETS.includes(requestedBucket) && (requestedBucket !== 'overdue' || showOverdue)
      ? requestedBucket
      : null

  const agents = useUserOptions(userId)

  // La página de la agenda. Solo se mandan los parámetros que no son el default.
  const params = {
    page: page - 1,
    size: PAGE_SIZE,
    userId,
    includeOverdue: showOverdue ? null : false,
    includeWithoutAlerts: showEmpty ? true : null,
    bucket,
    sort: sort === DEFAULT_SORT ? null : sort,
  }
  const agendaQuery = useQuery({
    queryKey: queryKeys.leads.agenda(params),
    queryFn: ({ signal }) => listAgenda(params, { signal }),
    placeholderData: keepPreviousData,
  })

  // Cuántos hay en cada tramo, con el mismo agente y los mismos vencidos.
  const summaryParams = { userId, includeOverdue: showOverdue ? null : false }
  const summaryQuery = useQuery({
    queryKey: queryKeys.leads.agendaSummary(summaryParams),
    queryFn: ({ signal }) => fetchAgendaSummary(summaryParams, { signal }),
    placeholderData: keepPreviousData,
  })

  const data = agendaQuery.data ?? null
  const rows = data?.content ?? []
  const summary = summaryQuery.data ?? null

  // Los números de cada grupo y de cada opción del selector.
  const countOf = (key) => {
    if (!summary) return null
    if (key === 'none') return summary.withoutAlerts ?? 0
    if (key === 'overdue' && !showOverdue) return 0
    return summary[key] ?? 0
  }
  const withAlertTotal = summary ? AGENDA_BUCKETS.reduce((sum, key) => sum + countOf(key), 0) : null
  const allTotal = summary ? withAlertTotal + (showEmpty ? countOf('none') : 0) : null
  const overdueCount = showOverdue ? countOf('overdue') : null

  // Nombre del agente de cada fila: es lo único que la agenda no trae.
  const users = useLookup('users', rows.map((row) => row.userId), findUser)

  const totalPages = data?.totalPages ?? 1

  return (
    <Container size="xl" py="xl">
      <Box mb="lg">
        <Title order={1} size="h2">
          Agenda de avisos
        </Title>
        <Text c="dimmed">
          {summary
            ? summary.hour > 0
              ? `${leadsCount(summary.hour)} con aviso en la próxima hora y ${summary.day} más en las próximas 24 horas.`
              : `${leadsCount(summary.day)} con aviso en las próximas 24 horas.`
            : 'Los leads ordenados por el tiempo que falta para su próximo aviso.'}
          {overdueCount > 0 && (
            <Text span c="danger" fw={600}>
              {` ${leadsCount(overdueCount)} con avisos vencidos.`}
            </Text>
          )}
        </Text>
      </Box>

      <Group align="flex-end" gap="md" mb="lg" wrap="wrap">
        <Select
          w={260}
          label="Ordenar por"
          data={SORT_OPTIONS}
          value={sort}
          onChange={(value) => setFilter('orden', value === DEFAULT_SORT ? null : value)}
          allowDeselect={false}
          leftSection={<IconClockHour4 size={16} />}
        />
        <Select
          w={300}
          label="Agente"
          placeholder={agents.state === 'loading' ? 'Cargando agentes...' : 'Todos los agentes'}
          data={agents.options}
          value={userId}
          onChange={(value) => setFilter('userId', value)}
          searchable
          clearable
          nothingFoundMessage="Sin coincidencias"
        />
        <Stack gap={8} mb={2}>
          <Switch
            label={overdueCount > 0 ? `Mostrar vencidos (${overdueCount})` : 'Mostrar vencidos'}
            checked={showOverdue}
            onChange={(event) => setFilter('vencidos', event.currentTarget.checked ? null : '0')}
          />
          <Switch
            label={
              summary && countOf('none') > 0
                ? `Mostrar leads sin avisos pendientes (${countOf('none')})`
                : 'Mostrar leads sin avisos pendientes'
            }
            checked={showEmpty}
            onChange={(event) => setFilter('sinAvisos', event.currentTarget.checked ? '1' : null)}
          />
        </Stack>
      </Group>

      {/* Tramo de tiempo. Los números salen del summary, de toda la agenda.
          En pantallas angostas el selector se desplaza de costado en vez de cortarse. */}
      <ScrollArea type="auto" scrollbarSize={6} offsetScrollbars="x" mb="md">
        <SegmentedControl
          value={bucket ?? ALL}
          onChange={(value) => setFilter('cuando', value === ALL ? null : value)}
          aria-label="Cuándo es el aviso"
          data={[
            { value: ALL, label: <TimeOption label="Todos" count={allTotal} /> },
            ...AGENDA_BUCKETS.map((key) => ({
              value: key,
              // Con los vencidos ocultos, su opción queda deshabilitada.
              disabled: key === 'overdue' && !showOverdue,
              label: <TimeOption label={BUCKETS[key].label} count={countOf(key)} />,
            })),
          ]}
        />
      </ScrollArea>

      {summaryQuery.isError && (
        <Alert color="yellow" icon={<IconAlertTriangle />} mb="md">
          No se pudieron cargar los totales por tramo: {summaryQuery.error.message}
        </Alert>
      )}

      {agendaQuery.isPending && (
        <Stack gap="xs">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={56} radius="md" />
          ))}
        </Stack>
      )}

      {agendaQuery.isError && (
        <Alert color="danger" icon={<IconAlertTriangle />} title="No se pudo cargar la agenda">
          {agendaQuery.error.message}
        </Alert>
      )}

      {/* Un tramo elegido, sin nada. */}
      {data && rows.length === 0 && bucket && (
        <Card variant="empty" radius="lg" padding="xl">
          <Stack align="center" gap="xs" py="lg">
            <Text fw={600}>{BUCKETS[bucket].empty}</Text>
            <Button variant="light" mt="xs" onClick={() => setFilter('cuando', null)}>
              Ver todos
            </Button>
          </Stack>
        </Card>
      )}

      {/* La agenda entera, sin nada. */}
      {data && rows.length === 0 && !bucket && (
        <Card variant="empty" radius="lg" padding="xl">
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconBellRinging size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {summary && withAlertTotal === 0 && countOf('none') === 0
                ? userId
                  ? 'Este agente no tiene leads'
                  : 'Todavía no hay leads'
                : 'No hay avisos pendientes'}
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              {!showOverdue
                ? 'Los vencidos están ocultos: activá "Mostrar vencidos" para verlos.'
                : 'Los avisos se agendan desde el detalle de cada lead.'}
            </Text>
            {showOverdue && (
              <Button component={Link} to="/dashboard/consultas" mt="md" variant="light">
                Ir a Clientes & Leads
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <Card
            variant="table"
            radius="lg"
            padding={0}
            style={{ opacity: agendaQuery.isPlaceholderData ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Cuándo</Table.Th>
                    <Table.Th>Aviso</Table.Th>
                    <Table.Th>Interesado</Table.Th>
                    <Table.Th>Propiedad</Table.Th>
                    <Table.Th>Agente</Table.Th>
                    <Table.Th>Etapa</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row, index) => {
                    const { nextAlert, overdue, pendingCount } = row
                    const detalle = `/dashboard/consultas/${row.id}`
                    // Un encabezado cada vez que empieza un tramo (también arriba de
                    // cada página). Con un tramo elegido, el selector ya lo nombra.
                    const rowBucket = bucketOf(row)
                    const startsGroup = !bucket && (index === 0 || bucketOf(rows[index - 1]) !== rowBucket)

                    return (
                      <Fragment key={row.id}>
                        {startsGroup && <GroupRow bucket={rowBucket} count={countOf(rowBucket)} />}
                        <Table.Tr
                          style={{
                            cursor: 'pointer',
                            // Una línea roja a la izquierda marca los vencidos.
                            boxShadow: overdue ? 'inset 3px 0 0 var(--mantine-color-danger-6)' : undefined,
                          }}
                          onClick={() => navigate(detalle)}
                        >
                          <Table.Td>
                            <WhenCell row={row} now={now} />
                          </Table.Td>
                          <Table.Td maw={300}>
                            {nextAlert ? (
                              <>
                                <Tooltip label={nextAlert.message} multiline maw={320} openDelay={400}>
                                  <Text size="sm" lineClamp={2}>
                                    {nextAlert.message}
                                  </Text>
                                </Tooltip>
                                {pendingCount > 1 && (
                                  <Text size="xs" c="dimmed">
                                    +{pendingCount - 1} {pendingCount === 2 ? 'aviso más' : 'avisos más'}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <Text size="sm" c="dimmed">
                                Sin avisos pendientes
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {/* El link deja abrir el lead con el teclado; el clic en la fila hace lo mismo. */}
                            <Anchor
                              component={Link}
                              to={detalle}
                              size="sm"
                              fw={600}
                              c="var(--app-ink)"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {row.personName ?? `Persona #${row.peopleId}`}
                            </Anchor>
                            {row.personPhone && (
                              <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {row.personPhone}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{row.propertyAddress ?? `Propiedad #${row.propertyId}`}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{users[row.userId]?.name ?? `#${row.userId}`}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color={CRM_STAGE_COLOR[row.stage]}>
                              {CRM_STAGE_LABEL[row.stage] ?? row.stage}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      </Fragment>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          {totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination total={totalPages} value={Math.min(page, totalPages)} onChange={goToPage} />
            </Group>
          )}
        </>
      )}
    </Container>
  )
}
