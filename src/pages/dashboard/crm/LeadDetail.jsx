import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Card,
  Container,
  Grid,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAlarm,
  IconAlertTriangle,
  IconCash,
  IconChevronRight,
  IconCircleCheck,
  IconHistory,
  IconUser,
} from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { useUserOptions } from '../../../hooks/useSelectOptions.js'
import { leadChildKey, queryKeys } from '../../../queries/keys.js'
import { ApiError } from '../../../services/api.js'
import {
  CRM_STAGE_COLOR,
  CRM_STAGE_LABEL,
  CRM_STAGE_OPTIONS,
  changeLeadStage,
  createHistoryEvent,
  findLead,
  leadToRequest,
  listAlerts,
  listHistory,
  listOffers,
  updateLead,
} from '../../../services/crm.js'
import { formatDate } from '../../../services/format.js'
import { findPerson } from '../../../services/people.js'
import { findProperty, formatPropertyPlace } from '../../../services/properties.js'
import { findUser } from '../../../services/users.js'
import LeadAlerts from './LeadAlerts.jsx'
import LeadOffers from './LeadOffers.jsx'
import LeadTimeline from './LeadTimeline.jsx'

const LIST_PATH = '/dashboard/consultas'

function SectionCard({ icon: Icon, title, children, extra }) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs">
      <Group justify="space-between" mb="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" size={34} radius="md">
            <Icon size={18} />
          </ThemeIcon>
          <Title order={2} size="h5">
            {title}
          </Title>
        </Group>
        {extra}
      </Group>
      {children}
    </Card>
  )
}

function InfoRow({ label, children }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm">{children}</Text>
    </div>
  )
}

/**
 * Trae el lead y todo lo que cuelga de él: cuatro consultas en paralelo.
 * Las claves de historial, ofertas y alertas están debajo de la del lead
 * ([leads, detail, 7, offers]), así que invalidar [leads] las refresca
 * a todas juntas, y también el listado de leads.
 */
function useLeadData(id) {
  const queryClient = useQueryClient()
  const [lead, history, offers, alerts] = useQueries({
    queries: [
      { queryKey: queryKeys.leads.detail(id), queryFn: ({ signal }) => findLead(id, { signal }) },
      { queryKey: leadChildKey(id, 'history'), queryFn: ({ signal }) => listHistory(id, { signal }) },
      { queryKey: leadChildKey(id, 'offers'), queryFn: ({ signal }) => listOffers(id, { signal }) },
      { queryKey: leadChildKey(id, 'alerts'), queryFn: ({ signal }) => listAlerts(id, { signal }) },
    ],
  })

  const all = [lead, history, offers, alerts]
  const failed = all.find((query) => query.error)
  const errorMessage = failed
    ? failed.error instanceof ApiError && failed.error.status === 404
      ? `No existe un lead con el identificador #${id}.`
      : failed.error.message
    : null

  // Con las cuatro respuestas se arma el objeto de la pantalla. Si falla una
  // recarga se siguen mostrando los datos anteriores junto con el aviso.
  let data = null
  if (all.every((query) => query.data)) {
    data = { lead: lead.data, history: history.data, offers: offers.data, alerts: alerts.data, error: errorMessage }
  } else if (errorMessage) {
    data = { error: errorMessage }
  }

  // Un cambio en el lead (etapa, oferta, evento) puede afectar al listado
  // también: se invalida todo lo de leads.
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
  return { data, reload }
}

/** Detalle de un lead: etapa, historial, datos, ofertas y recordatorios. */
export default function LeadDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { data, reload } = useLeadData(id)
  const [created, setCreated] = useState(Boolean(location.state?.created))
  const [action, setAction] = useState({ state: 'idle' })

  const lead = data?.lead
  // Los hooks van ANTES del `if (!lead) return` de abajo: React exige que se
  // llamen siempre, en el mismo orden, en cada render.
  const person = useLookup('people', [lead?.peopleId], findPerson)[lead?.peopleId]
  const property = useLookup('properties', [lead?.propertyId], findProperty)[lead?.propertyId]
  const agent = useLookup('users', [lead?.userId], findUser)[lead?.userId]
  const agents = useUserOptions(lead ? String(lead.userId) : null)

  if (!lead) {
    return (
      <Container size="xl" py="xl">
        {data?.error ? (
          <Alert color="red" icon={<IconAlertTriangle />} title="No se pudo abrir el lead">
            {data.error}{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Volver al listado
            </Anchor>
          </Alert>
        ) : (
          <Stack>
            <Skeleton height={90} radius="lg" />
            <Skeleton height={320} radius="lg" />
          </Stack>
        )}
      </Container>
    )
  }

  const runLeadAction = async (work) => {
    setAction({ state: 'saving' })
    try {
      await work()
      setAction({ state: 'idle' })
    } catch (error) {
      setAction({ state: 'error', message: error.message })
    }
    // Un cambio de etapa deja su evento: se recarga todo para verlo.
    reload()
  }

  // El selector de etapas: PUT del lead + evento en el historial (ver crm.js).
  const changeStage = (stage) => {
    if (stage === lead.stage) return
    runLeadAction(() => changeLeadStage(lead, stage))
  }

  // Reasignar el agente: actualiza el lead y deja una nota con el cambio.
  const reassign = (value) => {
    if (!value || Number(value) === lead.userId) return
    const label = agents.options.find((option) => option.value === value)?.label ?? `#${value}`
    runLeadAction(async () => {
      await updateLead(lead.id, leadToRequest(lead, { userId: Number(value) }))
      await createHistoryEvent(lead.id, {
        userId: Number(value),
        type: 'NOTE',
        comments: `Lead reasignado de ${agent?.name ?? `#${lead.userId}`} a ${label.split(' · ')[0]}`,
      })
    })
  }

  const busy = action.state === 'saving'
  const pendingAlerts = data.alerts.filter((alert) => !alert.isRead).length

  return (
    <>
      <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="xl" py="xl">
          <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
            <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
              Clientes & Leads
            </Anchor>
            <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
              Lead #{lead.id}
            </Text>
          </Breadcrumbs>
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={1} size="h2" mb={4}>
                {person?.name ?? `Persona #${lead.peopleId}`}
              </Title>
              <Text c="dimmed">
                Interesado en {property?.address ?? `la propiedad #${lead.propertyId}`} · desde el{' '}
                {formatDate(lead.createdAt)}
              </Text>
            </div>
            <Badge size="lg" variant="light" color={CRM_STAGE_COLOR[lead.stage]}>
              {CRM_STAGE_LABEL[lead.stage] ?? lead.stage}
            </Badge>
          </Group>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        {created && (
          <Alert
            color="teal"
            icon={<IconCircleCheck />}
            title="Lead creado"
            mb="lg"
            withCloseButton
            onClose={() => setCreated(false)}
          >
            Registre el primer contacto o agende un recordatorio.
          </Alert>
        )}
        {action.state === 'error' && (
          <Alert
            color="red"
            icon={<IconAlertTriangle />}
            title="No se pudo actualizar el lead"
            mb="lg"
            withCloseButton
            onClose={() => setAction({ state: 'idle' })}
          >
            {action.message}
          </Alert>
        )}
        {data.error && (
          <Alert color="orange" icon={<IconAlertTriangle />} title="No se pudo recargar" mb="lg">
            {data.error}
          </Alert>
        )}

        <Card withBorder radius="lg" padding="lg" shadow="xs" mb="xl">
          <Text size="sm" fw={600} mb="xs">
            Etapa
          </Text>
          <ScrollArea type="auto" offsetScrollbars>
            {/* Las 6 etapas como botones contiguos; el seleccionado es la etapa actual.
                ScrollArea permite deslizarlos de costado en pantallas chicas. */}
            <SegmentedControl
              fullWidth
              miw={560}
              value={lead.stage}
              onChange={changeStage}
              disabled={busy}
              data={CRM_STAGE_OPTIONS}
              color={CRM_STAGE_COLOR[lead.stage]}
            />
          </ScrollArea>
          <Text size="xs" c="dimmed" mt="xs">
            Cada cambio queda en el historial. Cargar una oferta pasa el lead a negociación y
            aceptarla lo da por ganado.
          </Text>
        </Card>

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <SectionCard icon={IconHistory} title="Historial">
              {/* Cada sección recibe `reload`: después de un cambio se vuelve a
                  pedir todo, así se ven juntos la oferta, la etapa y el evento nuevos. */}
              <LeadTimeline lead={lead} history={data.history} onChanged={reload} />
            </SectionCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 5 }}>
            <Stack gap="xl">
              <SectionCard icon={IconUser} title="Datos">
                <Stack gap="sm">
                  <InfoRow label="Interesado">
                    {person ? (
                      <>
                        {person.name} · {person.phone} · {person.email}{' '}
                        <Anchor component={Link} to={`/dashboard/personas/${person.id}/editar`} size="sm">
                          Editar
                        </Anchor>
                      </>
                    ) : (
                      `Persona #${lead.peopleId}`
                    )}
                  </InfoRow>
                  <InfoRow label="Propiedad">
                    {property ? (
                      <>
                        {property.address}, {formatPropertyPlace(property)}{' '}
                        <Anchor component={Link} to={`/dashboard/propiedades/${property.id}/editar`} size="sm">
                          Ver
                        </Anchor>
                      </>
                    ) : (
                      `Propiedad #${lead.propertyId} (dada de baja o inexistente)`
                    )}
                  </InfoRow>
                  <Select
                    label="Agente asignado"
                    data={agents.options}
                    value={String(lead.userId)}
                    onChange={reassign}
                    disabled={busy || agents.state === 'loading'}
                    searchable
                    allowDeselect={false}
                    nothingFoundMessage="Sin coincidencias"
                  />
                </Stack>
              </SectionCard>

              <SectionCard icon={IconCash} title="Ofertas">
                <LeadOffers lead={lead} offers={data.offers} onChanged={reload} />
              </SectionCard>

              <SectionCard
                icon={IconAlarm}
                title="Recordatorios"
                extra={
                  pendingAlerts > 0 && (
                    <Badge variant="light" color="orange">
                      {pendingAlerts} {pendingAlerts === 1 ? 'pendiente' : 'pendientes'}
                    </Badge>
                  )
                }
              >
                <LeadAlerts lead={lead} alerts={data.alerts} agents={agents} onChanged={reload} />
              </SectionCard>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </>
  )
}
