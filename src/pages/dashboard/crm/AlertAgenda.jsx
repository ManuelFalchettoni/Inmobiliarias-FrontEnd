import { Link, useNavigate } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Pagination,
  Progress,
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
import { IconAlertTriangle, IconBellRinging, IconChevronRight, IconClockHour4 } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { useNow } from '../../../hooks/useNow.js'
import { useUserOptions } from '../../../hooks/useSelectOptions.js'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { leadChildKey, queryKeys } from '../../../queries/keys.js'
import {
  CRM_STAGE_COLOR,
  CRM_STAGE_LABEL,
  listAlerts,
  listAllLeads,
  upcomingAlerts,
} from '../../../services/crm.js'
import { formatDateTime, formatTimeLeft } from '../../../services/format.js'
import { findPerson } from '../../../services/people.js'
import { findProperty, formatPropertyPlace } from '../../../services/properties.js'
import { findUser } from '../../../services/users.js'

const PAGE_SIZE = 20

/** Orden de la agenda. Los leads sin aviso próximo van siempre al final. */
const SORT_OPTIONS = [
  { value: 'proximo', label: 'Menos tiempo para el aviso' },
  { value: 'lejano', label: 'Más tiempo para el aviso' },
]
const DEFAULT_SORT = 'proximo'

const HOUR = 60 * 60 * 1000

/** Color del "falta" según la urgencia. */
function urgencyColor(ms) {
  if (ms < HOUR) return 'red'
  if (ms < 24 * HOUR) return 'orange'
  if (ms < 3 * 24 * HOUR) return 'yellow'
  return 'blue'
}


/**
 * Agenda de avisos (`/dashboard/avisos`): los leads ordenados por el tiempo que
 * falta para su próximo aviso.
 *
 * El backend no tiene un endpoint con todos los avisos: se traen todos los
 * leads (de a 100) y los avisos de cada uno con `GET .../alerts`, y el orden se
 * arma acá. Las claves de caché son las mismas que usa el detalle del lead, así
 * que lo que se cambia allá se ve acá y viceversa.
 *
 * Solo cuentan los avisos que faltan: sin cumplir y con fecha futura.
 */
export default function AlertAgenda() {
  const navigate = useNavigate()
  const now = useNow()
  const { searchParams, page, setFilter, goToPage } = useUrlFilters()
  const userId = searchParams.get('userId') ?? null
  const sort = SORT_OPTIONS.some((o) => o.value === searchParams.get('orden'))
    ? searchParams.get('orden')
    : DEFAULT_SORT
  // `?sinAvisos=0` oculta los leads que no tienen ningún aviso por delante.
  const showEmpty = searchParams.get('sinAvisos') !== '0'

  const agents = useUserOptions(userId)

  // 1. Todos los leads. La clave cuelga de ['leads', 'list'], así que crear o
  //    editar un lead (que invalida ['leads']) también refresca la agenda.
  const leadsQuery = useQuery({
    queryKey: [...queryKeys.leads.lists(), 'all', { userId }],
    queryFn: ({ signal }) => listAllLeads({ userId }, { signal }),
  })
  const leads = leadsQuery.data ?? []

  // 2. Los avisos de cada lead, en paralelo.
  const alertQueries = useQueries({
    queries: leads.map((lead) => ({
      queryKey: leadChildKey(lead.id, 'alerts'),
      queryFn: ({ signal }) => listAlerts(lead.id, { signal }),
    })),
  })
  const loadedAlerts = alertQueries.filter((q) => !q.isPending).length
  const failedAlerts = alertQueries.filter((q) => q.isError).length
  const loadingAlerts = leads.length > 0 && loadedAlerts < leads.length

  // 3. Cada lead con su próximo aviso y cuánto falta.
  const rows = leads.map((lead, index) => {
    const upcoming = upcomingAlerts(alertQueries[index]?.data, now)
    const next = upcoming[0] ?? null
    return {
      lead,
      next,
      pending: upcoming.length,
      timeLeft: next ? new Date(next.alertDate).getTime() - now : null,
      loading: alertQueries[index]?.isPending ?? true,
    }
  })

  const withAlert = rows.filter((row) => row.next)
  const withoutAlert = rows.filter((row) => !row.next)
  withAlert.sort((a, b) => (sort === 'proximo' ? a.timeLeft - b.timeLeft : b.timeLeft - a.timeLeft))
  const sorted = showEmpty ? [...withAlert, ...withoutAlert] : withAlert

  // Paginado en el navegador: el orden necesita todos los leads a la vez.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Nombres solo de las filas visibles.
  const people = useLookup('people', visible.map((r) => r.lead.peopleId), findPerson)
  const properties = useLookup('properties', visible.map((r) => r.lead.propertyId), findProperty)
  const users = useLookup('users', visible.map((r) => r.lead.userId), findUser)

  const nextHour = withAlert.filter((r) => r.timeLeft < HOUR).length
  const nextDay = withAlert.filter((r) => r.timeLeft < 24 * HOUR).length

  return (
    <Container size="xl" py="xl">
      <Group gap="sm" align="flex-start" wrap="nowrap" mb="lg">
        <ThemeIcon variant="light" size={44} radius="md">
          <IconBellRinging size={24} />
        </ThemeIcon>
        <div>
          <Title order={1} size="h2">
            Agenda de avisos
          </Title>
          <Text c="dimmed">
            {leadsQuery.isSuccess && !loadingAlerts
              ? `${withAlert.length} ${withAlert.length === 1 ? 'lead tiene' : 'leads tienen'} avisos por delante · ${nextDay} en las próximas 24 h · ${nextHour} en la próxima hora`
              : 'Leads ordenados por el tiempo que falta para su próximo aviso.'}
          </Text>
        </div>
      </Group>

      <Group align="flex-end" gap="md" mb="md">
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
        <Switch
          mb={8}
          label="Mostrar leads sin avisos próximos"
          checked={showEmpty}
          onChange={(event) => setFilter('sinAvisos', event.currentTarget.checked ? null : '0')}
        />
      </Group>

      {loadingAlerts && (
        <Stack gap={4} mb="md">
          <Text size="xs" c="dimmed">
            Cargando avisos: {loadedAlerts} de {leads.length} leads
          </Text>
          <Progress value={(loadedAlerts / leads.length) * 100} size="sm" animated />
        </Stack>
      )}

      {failedAlerts > 0 && !loadingAlerts && (
        <Alert color="yellow" icon={<IconAlertTriangle />} mb="md">
          No se pudieron cargar los avisos de {failedAlerts} {failedAlerts === 1 ? 'lead' : 'leads'}: aparecen
          como sin avisos próximos.
        </Alert>
      )}

      {leadsQuery.isPending && (
        <Stack gap="xs">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={56} radius="md" />
          ))}
        </Stack>
      )}

      {leadsQuery.isError && (
        <Alert color="red" icon={<IconAlertTriangle />} title="No se pudo cargar la agenda">
          {leadsQuery.error.message}
        </Alert>
      )}

      {leadsQuery.isSuccess && !loadingAlerts && sorted.length === 0 && (
        <Card withBorder radius="lg" padding="xl" shadow="xs">
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconBellRinging size={28} />
            </ThemeIcon>
            <Text fw={600}>
              {leads.length === 0
                ? userId
                  ? 'Este agente no tiene leads'
                  : 'Todavía no hay leads'
                : 'No hay avisos por delante'}
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Los avisos se agendan desde el detalle de cada lead.
            </Text>
            <Button component={Link} to="/dashboard/consultas" mt="md" variant="light">
              Ir a Clientes & Leads
            </Button>
          </Stack>
        </Card>
      )}

      {/* La tabla espera a tener todos los avisos: sin ellos el orden saltaría. */}
      {!loadingAlerts && visible.length > 0 && (
        <>
          <Card withBorder radius="lg" padding={0} shadow="xs">
            <Table.ScrollContainer minWidth={960}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Falta</Table.Th>
                    <Table.Th>Próximo aviso</Table.Th>
                    <Table.Th>Interesado</Table.Th>
                    <Table.Th>Propiedad</Table.Th>
                    <Table.Th>Agente</Table.Th>
                    <Table.Th>Etapa</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visible.map(({ lead, next, pending, timeLeft, loading }) => {
                    const person = people[lead.peopleId]
                    const property = properties[lead.propertyId]
                    const detalle = `/dashboard/consultas/${lead.id}`

                    return (
                      <Table.Tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => navigate(detalle)}>
                        {/* nowrap: el "falta" no se corta aunque la tabla se achique. */}
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {loading ? (
                            <Skeleton height={22} width={90} radius="xl" />
                          ) : next ? (
                            <Badge
                              variant="light"
                              size="lg"
                              color={urgencyColor(timeLeft)}
                              tt="none"
                              styles={{ root: { overflow: 'visible' }, label: { overflow: 'visible' } }}
                            >
                              {formatTimeLeft(timeLeft)}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">
                              Sin avisos
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td maw={280}>
                          {next && (
                            <>
                              <Text size="sm" fw={500}>
                                {formatDateTime(next.alertDate)}
                              </Text>
                              <Tooltip label={next.message} multiline maw={320} openDelay={400}>
                                <Text size="xs" c="dimmed" truncate>
                                  {next.message}
                                </Text>
                              </Tooltip>
                              {pending > 1 && (
                                <Text size="xs" c="dimmed">
                                  +{pending - 1} {pending === 2 ? 'aviso más' : 'avisos más'}
                                </Text>
                              )}
                            </>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {person?.name ?? `Persona #${lead.peopleId}`}
                          </Text>
                          {person && (
                            <Text size="xs" c="dimmed" ff="monospace">
                              {person.phone}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{property?.address ?? `Propiedad #${lead.propertyId}`}</Text>
                          {property && (
                            <Text size="xs" c="dimmed">
                              {formatPropertyPlace(property)}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{users[lead.userId]?.name ?? `#${lead.userId}`}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={CRM_STAGE_COLOR[lead.stage]}>
                            {CRM_STAGE_LABEL[lead.stage] ?? lead.stage}
                          </Badge>
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

          {totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination total={totalPages} value={currentPage} onChange={goToPage} />
            </Group>
          )}
        </>
      )}
    </Container>
  )
}
