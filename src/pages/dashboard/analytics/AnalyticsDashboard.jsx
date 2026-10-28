import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Box,
  Card,
  Container,
  Grid,
  Group,
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
  IconAlarm,
  IconAlertTriangle,
  IconBuildingEstate,
  IconChartBar,
  IconFileText,
  IconMessages,
} from '@tabler/icons-react'

import { useAuth } from '../../../context/auth-context.js'
import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { useUrlFilters } from '../../../hooks/useUrlFilters.js'
import { queryKeys } from '../../../queries/keys.js'
import { getAnalyticsSummary } from '../../../services/analytics.js'
import { CONTRACT_STATUS_OPTIONS, CONTRACT_TYPE_OPTIONS } from '../../../services/contracts.js'
import { CRM_STAGE_OPTIONS, OFFER_STATUS_OPTIONS } from '../../../services/crm.js'
import {
  CURRENCY_OPTIONS,
  OPERATION_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  formatPrice,
} from '../../../services/properties.js'

const formatCount = (value) => Number(value ?? 0).toLocaleString('es-AR')

/** Tarjeta con un número grande y una línea de contexto debajo. */
function StatTile({ icon: Icon, label, value, detail, detailColor = 'dimmed' }) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <ThemeIcon variant="light" size={32} radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
      <Text fz={32} fw={700} lh={1.1} mt="xs">
        {value}
      </Text>
      <Text size="sm" c={detailColor} mt={4}>
        {detail}
      </Text>
    </Card>
  )
}

/**
 * Barras horizontales de una sola serie: una fila por clave del enum, en el
 * orden de `options`, con la etiqueta a la izquierda y el valor a la derecha.
 * Un solo color (el principal): el largo es lo que se compara, no el tono.
 */
function BarList({ options, counts }) {
  const total = options.reduce((sum, option) => sum + (counts?.[option.value] ?? 0), 0)
  const max = Math.max(1, ...options.map((option) => counts?.[option.value] ?? 0))

  return (
    <Stack gap={6}>
      {options.map((option) => {
        const value = counts?.[option.value] ?? 0
        const share = total ? Math.round((value / total) * 100) : 0
        return (
          <Tooltip
            key={option.value}
            label={`${option.label}: ${formatCount(value)}${total ? ` (${share}%)` : ''}`}
            withArrow
            position="top-start"
            openDelay={150}
          >
            {/* La fila entera es el área de hover, más grande que la barra. */}
            <Group gap="sm" wrap="nowrap" py={2}>
              <Text size="sm" w={130} truncate style={{ flexShrink: 0 }}>
                {option.label}
              </Text>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Box
                  h={12}
                  w={`${(value / max) * 100}%`}
                  miw={value > 0 ? 4 : 0}
                  bg="var(--mantine-primary-color-filled)"
                  style={{ borderRadius: '0 4px 4px 0' }}
                />
              </Box>
              <Text size="sm" fw={600} w={44} ta="right" style={{ flexShrink: 0 }}>
                {formatCount(value)}
              </Text>
            </Group>
          </Tooltip>
        )
      })}
    </Stack>
  )
}

function ChartCard({ title, caption, children }) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" h="100%">
      <Title order={2} size="h5">
        {title}
      </Title>
      <Text size="xs" c="dimmed" mb="md">
        {caption}
      </Text>
      {children}
    </Card>
  )
}

function AgentTable({ agents }) {
  if (agents.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Ningún agente tiene leads ni avisos pendientes.
      </Text>
    )
  }

  return (
    <Table.ScrollContainer minWidth={520}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Agente</Table.Th>
            <Table.Th ta="right">Leads</Table.Th>
            <Table.Th ta="right">Cerrados</Table.Th>
            <Table.Th ta="right">Avisos vencidos</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {agents.map((agent) => (
            <Table.Tr key={agent.userId}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {agent.name ?? `Usuario #${agent.userId}`}
                </Text>
              </Table.Td>
              <Table.Td ta="right">{formatCount(agent.leads)}</Table.Td>
              <Table.Td ta="right">{formatCount(agent.closedLeads)}</Table.Td>
              <Table.Td ta="right">
                {agent.expiredAlerts > 0 ? (
                  <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                    {formatCount(agent.expiredAlerts)}
                  </Badge>
                ) : (
                  <Text size="sm" c="dimmed" span>
                    0
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

/**
 * Analítica & Reportes (`/dashboard/analitica`): el resumen de
 * `GET /api/analytics/summary`. Cada uno ve su inmobiliaria; el admin ve todas
 * o filtra por una con `?agencyId=` (queda en la URL, como los demás filtros).
 */
export default function AnalyticsDashboard() {
  const { isAdmin } = useAuth()
  const { searchParams, setFilter } = useUrlFilters()
  const agencyId = isAdmin ? searchParams.get('agencyId') : null
  const agencies = useAgencyOptions(agencyId)

  const query = useQuery({
    queryKey: queryKeys.analytics.summary(agencyId),
    queryFn: ({ signal }) => getAnalyticsSummary({ agencyId }, { signal }),
  })
  const data = query.data

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-end" mb="lg" gap="md">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconChartBar size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Analítica & Reportes
            </Title>
            <Text c="dimmed">Propiedades, leads, ofertas y contratos, con el rendimiento de cada agente.</Text>
          </div>
        </Group>
        {isAdmin && (
          <Select
            w={300}
            label="Inmobiliaria"
            placeholder={agencies.state === 'loading' ? 'Cargando inmobiliarias...' : 'Todas las inmobiliarias'}
            data={agencies.options}
            value={agencyId}
            onChange={(value) => setFilter('agencyId', value)}
            searchable
            clearable
            nothingFoundMessage="Sin coincidencias"
          />
        )}
      </Group>

      {query.isError && (
        <Alert color="red" icon={<IconAlertTriangle />} title="No se pudo cargar la analítica">
          {query.error.status === 403
            ? 'Tu usuario no tiene una inmobiliaria asignada: no hay datos para mostrar.'
            : query.error.message}
        </Alert>
      )}

      {query.isPending && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={130} radius="lg" />
            ))}
          </SimpleGrid>
          <Skeleton height={280} radius="lg" />
        </Stack>
      )}

      {data && (
        <Stack gap="xl">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <StatTile
              icon={IconBuildingEstate}
              label="Propiedades activas"
              value={formatCount(data.properties.active)}
              detail={`${formatCount(data.properties.inactive)} ${data.properties.inactive === 1 ? 'dada' : 'dadas'} de baja`}
            />
            <StatTile
              icon={IconMessages}
              label="Leads"
              value={formatCount(data.crm.totalLeads)}
              detail={`${data.crm.closeRate.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% de cierre (cerrados sobre cerrados + descartados)`}
            />
            <StatTile
              icon={IconAlarm}
              label="Avisos pendientes"
              value={formatCount(data.crm.pendingAlerts)}
              detail={
                data.crm.expiredAlerts > 0
                  ? `${formatCount(data.crm.expiredAlerts)} ${data.crm.expiredAlerts === 1 ? 'vencido' : 'vencidos'}`
                  : 'Ninguno vencido'
              }
              detailColor={data.crm.expiredAlerts > 0 ? 'red' : 'dimmed'}
            />
            <StatTile
              icon={IconFileText}
              label="Contratos"
              value={formatCount(data.contracts.total)}
              detail={
                // Monto de los vigentes, una línea por moneda con algo cargado.
                `Vigentes: ${
                  CURRENCY_OPTIONS.filter((c) => Number(data.contracts.activeAmountByCurrency?.[c.value]) > 0)
                    .map((c) => formatPrice({ currency: c.value, amount: data.contracts.activeAmountByCurrency[c.value] }))
                    .join(' · ') || 'sin montos'
                }`
              }
            />
          </SimpleGrid>

          <Grid gutter="xl">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <ChartCard title="Leads por etapa" caption="En el orden en que avanza un lead.">
                <BarList options={CRM_STAGE_OPTIONS} counts={data.crm.leadsByStage} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <ChartCard title="Ofertas por estado" caption="Todas las ofertas cargadas en los leads.">
                <BarList options={OFFER_STATUS_OPTIONS} counts={data.crm.offersByStatus} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <ChartCard title="Contratos por estado" caption={`${formatCount(data.contracts.total)} contratos en total.`}>
                <BarList options={CONTRACT_STATUS_OPTIONS} counts={data.contracts.byStatus} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <ChartCard title="Contratos por tipo" caption="Venta y alquiler, en cualquier estado.">
                <BarList options={CONTRACT_TYPE_OPTIONS} counts={data.contracts.byType} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <ChartCard title="Propiedades por tipo" caption="Solo las activas.">
                <BarList options={PROPERTY_TYPE_OPTIONS} counts={data.properties.byType} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <ChartCard
                title="Propiedades por operación"
                caption="Solo las activas; una con precio de venta y de alquiler cuenta en las dos."
              >
                <BarList options={OPERATION_TYPE_OPTIONS} counts={data.properties.byOperation} />
              </ChartCard>
            </Grid.Col>
          </Grid>

          <Card withBorder radius="lg" padding="lg" shadow="xs">
            <Title order={2} size="h5">
              Rendimiento por agente
            </Title>
            <Text size="xs" c="dimmed" mb="md">
              Un renglón por agente con leads o avisos pendientes.
            </Text>
            <AgentTable agents={data.agents ?? []} />
          </Card>
        </Stack>
      )}
    </Container>
  )
}
