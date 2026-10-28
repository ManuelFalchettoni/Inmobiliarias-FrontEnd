import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Box,
  Card,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  RingProgress,
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
import { CONTRACT_STATUS_LABEL, CONTRACT_TYPE_LABEL } from '../../../services/contracts.js'
import { CRM_STAGE_LABEL, OFFER_STATUS_LABEL } from '../../../services/crm.js'
import {
  CURRENCY_OPTIONS,
  OPERATION_TYPE_LABEL,
  PROPERTY_TYPE_OPTIONS,
  formatPrice,
} from '../../../services/properties.js'

/**
 * Colores de los gráficos. El teal es el del tema; el azul y el naranja marcan
 * la segunda y tercera categoría, y el gris queda para "lo que no prosperó"
 * (descartado, rechazado, cancelado), siempre con su etiqueta al lado.
 * Paleta validada para daltonismo con el orden en que se usan abajo.
 */
const COLOR = {
  primary: '#0ca678', // teal.7
  second: '#1c7ed6', // blue.7
  third: '#e8590c', // orange.8
  rest: '#868e96', // gray.6
}

/** Etapas abiertas del embudo; cerrado y descartado van aparte, como resultado. */
const OPEN_STAGES = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'VISITED', 'NEGOTIATING']

const formatCount = (value) => Number(value ?? 0).toLocaleString('es-AR')
const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0)

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

function ChartCard({ title, caption, children }) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" h="100%">
      <Title order={2} size="h5">
        {title}
      </Title>
      <Text size="xs" c="dimmed" mb="lg">
        {caption}
      </Text>
      {children}
    </Card>
  )
}

/** Cuadradito de color + etiqueta + valor: la leyenda de los gráficos de partes. */
function LegendRow({ color, label, value, share }) {
  return (
    <Group gap="xs" wrap="nowrap" justify="space-between">
      <Group gap={8} wrap="nowrap">
        <Box w={10} h={10} bg={color} style={{ borderRadius: 3, flexShrink: 0 }} />
        <Text size="sm">{label}</Text>
      </Group>
      <Text size="sm" fw={600}>
        {formatCount(value)}
        {share != null && (
          <Text span size="xs" c="dimmed" fw={400}>
            {' '}
            · {share}%
          </Text>
        )}
      </Text>
    </Group>
  )
}

/**
 * Columnas verticales de una sola serie (un solo color). El valor va arriba de
 * cada columna y la etiqueta abajo; la columna entera es el área de hover.
 */
function ColumnChart({ items, height = 150 }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <Group gap={6} align="flex-end" wrap="nowrap" h={height + 48}>
      {items.map((item) => (
        <Tooltip key={item.key} label={`${item.label}: ${formatCount(item.value)}`} withArrow>
          <Stack gap={4} align="center" justify="flex-end" style={{ flex: 1, minWidth: 0 }} h="100%">
            <Text size="sm" fw={600}>
              {formatCount(item.value)}
            </Text>
            <Box
              w="70%"
              maw={56}
              h={Math.max((item.value / max) * height, item.value > 0 ? 4 : 1)}
              bg={item.value > 0 ? COLOR.primary : 'var(--mantine-color-gray-3)'}
              style={{ borderRadius: '4px 4px 0 0' }}
            />
            <Text size="xs" c="dimmed" ta="center" lh={1.2} h={30} lineClamp={2}>
              {item.label}
            </Text>
          </Stack>
        </Tooltip>
      ))}
    </Group>
  )
}

/** Barra horizontal partida en segmentos (parte del total), con 2px de aire entre cada uno. */
function SplitBar({ segments, height = 14 }) {
  const visible = segments.filter((segment) => segment.value > 0)
  const total = visible.reduce((sum, segment) => sum + segment.value, 0)
  if (total === 0) return <Box h={height} bg="gray.2" style={{ borderRadius: 4 }} />
  return (
    <Group gap={2} wrap="nowrap" h={height}>
      {visible.map((segment, index) => (
        <Tooltip
          key={segment.key}
          label={`${segment.label}: ${formatCount(segment.value)} (${percent(segment.value, total)}%)`}
          withArrow
        >
          <Box
            h="100%"
            bg={segment.color}
            style={{
              flex: segment.value,
              borderRadius: `${index === 0 ? 4 : 0}px ${index === visible.length - 1 ? 4 : 0}px ${
                index === visible.length - 1 ? 4 : 0
              }px ${index === 0 ? 4 : 0}px`,
            }}
          />
        </Tooltip>
      ))}
    </Group>
  )
}

/** Embudo de leads: las etapas abiertas en columnas y el resultado con su tasa de cierre. */
function LeadPipeline({ crm }) {
  const closed = crm.leadsByStage.CLOSED ?? 0
  const discarded = crm.leadsByStage.DISCARDED ?? 0
  const open = OPEN_STAGES.reduce((sum, stage) => sum + (crm.leadsByStage[stage] ?? 0), 0)

  return (
    <Grid gutter="xl" align="center">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
          En curso · {formatCount(open)}
        </Text>
        <ColumnChart
          items={OPEN_STAGES.map((stage) => ({
            key: stage,
            label: CRM_STAGE_LABEL[stage],
            value: crm.leadsByStage[stage] ?? 0,
          }))}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
          Resultado · {formatCount(closed + discarded)}
        </Text>
        <Center>
          <RingProgress
            size={140}
            thickness={14}
            // Una sección en 0 con roundCaps se dibuja como un punto suelto: se saca.
            sections={[
              { value: crm.closeRate, color: COLOR.primary, tooltip: `Cerrados: ${formatCount(closed)}` },
              {
                value: closed + discarded ? 100 - crm.closeRate : 0,
                color: COLOR.rest,
                tooltip: `Descartados: ${formatCount(discarded)}`,
              },
            ].filter((section) => section.value > 0)}
            rootColor="var(--mantine-color-gray-2)"
            label={
              <Stack gap={0} align="center">
                <Text fw={700} fz={24} lh={1}>
                  {crm.closeRate.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
                </Text>
                <Text size="xs" c="dimmed">
                  de cierre
                </Text>
              </Stack>
            }
          />
        </Center>
        <Stack gap={4} mt="sm">
          <LegendRow color={COLOR.primary} label={CRM_STAGE_LABEL.CLOSED} value={closed} />
          <LegendRow color={COLOR.rest} label={CRM_STAGE_LABEL.DISCARDED} value={discarded} />
        </Stack>
      </Grid.Col>
    </Grid>
  )
}

/** Ofertas: el total y una barra partida por estado. */
function OfferBreakdown({ offersByStatus }) {
  const segments = [
    { key: 'ACCEPTED', color: COLOR.primary },
    { key: 'PENDING', color: COLOR.third },
    { key: 'REJECTED', color: COLOR.rest },
  ].map((segment) => ({ ...segment, label: OFFER_STATUS_LABEL[segment.key], value: offersByStatus[segment.key] ?? 0 }))
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <Stack gap="md">
      <div>
        <Text fz={40} fw={700} lh={1}>
          {formatCount(total)}
        </Text>
        <Text size="sm" c="dimmed">
          {total === 1 ? 'oferta cargada' : 'ofertas cargadas'}
        </Text>
      </div>
      <SplitBar segments={segments} height={18} />
      <Stack gap={6}>
        {segments.map((segment) => (
          <LegendRow key={segment.key} color={segment.color} label={segment.label} value={segment.value} share={percent(segment.value, total)} />
        ))}
      </Stack>
    </Stack>
  )
}

/** Contratos: dona por estado, reparto venta/alquiler y montos vigentes. */
function ContractBreakdown({ contracts }) {
  const byStatus = [
    { key: 'ACTIVE', color: COLOR.primary },
    { key: 'FINISHED', color: COLOR.second },
    { key: 'CANCELLED', color: COLOR.rest },
  ].map((item) => ({ ...item, label: CONTRACT_STATUS_LABEL[item.key], value: contracts.byStatus[item.key] ?? 0 }))
  const byType = [
    { key: 'RENT', color: COLOR.primary },
    { key: 'SALE', color: COLOR.second },
  ].map((item) => ({ ...item, label: CONTRACT_TYPE_LABEL[item.key], value: contracts.byType[item.key] ?? 0 }))
  const amounts = CURRENCY_OPTIONS.filter((c) => Number(contracts.activeAmountByCurrency?.[c.value]) > 0)

  return (
    <Stack gap="lg">
      <Group gap="xl" wrap="nowrap" align="center">
        <RingProgress
          size={130}
          thickness={14}
          sections={byStatus
            .filter((item) => item.value > 0)
            .map((item) => ({
              value: (item.value / Math.max(1, contracts.total)) * 100,
              color: item.color,
              tooltip: `${item.label}: ${formatCount(item.value)}`,
            }))}
          rootColor="var(--mantine-color-gray-2)"
          label={
            <Stack gap={0} align="center">
              <Text fw={700} fz={24} lh={1}>
                {formatCount(contracts.total)}
              </Text>
              <Text size="xs" c="dimmed">
                contratos
              </Text>
            </Stack>
          }
        />
        <Stack gap={6} style={{ flex: 1 }}>
          {byStatus.map((item) => (
            <LegendRow key={item.key} color={item.color} label={item.label} value={item.value} share={percent(item.value, contracts.total)} />
          ))}
        </Stack>
      </Group>

      <Divider />

      <div>
        <Group justify="space-between" mb={6}>
          {byType.map((item) => (
            <Group key={item.key} gap={8}>
              <Box w={10} h={10} bg={item.color} style={{ borderRadius: 3 }} />
              <Text size="sm">
                {item.label}{' '}
                <Text span fw={600}>
                  {formatCount(item.value)}
                </Text>
              </Text>
            </Group>
          ))}
        </Group>
        <SplitBar segments={byType} />
      </div>

      <div>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
          Monto de los vigentes
        </Text>
        {amounts.length === 0 ? (
          <Text size="sm" c="dimmed">
            Sin contratos vigentes con monto.
          </Text>
        ) : (
          <Group gap="lg">
            {amounts.map((c) => (
              <Text key={c.value} fz={20} fw={700}>
                {formatPrice({ currency: c.value, amount: contracts.activeAmountByCurrency[c.value] })}
              </Text>
            ))}
          </Group>
        )}
      </div>
    </Stack>
  )
}

/** Propiedades activas: columnas por tipo (de más a menos) y reparto venta/alquiler. */
function PropertyBreakdown({ properties }) {
  const types = PROPERTY_TYPE_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    value: properties.byType[option.value] ?? 0,
  }))
  const withData = types.filter((type) => type.value > 0).sort((a, b) => b.value - a.value)
  const empty = types.filter((type) => type.value === 0)
  const operations = [
    { key: 'SALE', color: COLOR.primary },
    { key: 'RENT', color: COLOR.second },
  ].map((item) => ({ ...item, label: OPERATION_TYPE_LABEL[item.key], value: properties.byOperation[item.key] ?? 0 }))

  return (
    <Stack gap="lg">
      {withData.length === 0 ? (
        <Text size="sm" c="dimmed">
          No hay propiedades activas.
        </Text>
      ) : (
        <ColumnChart items={withData} height={120} />
      )}
      {empty.length > 0 && withData.length > 0 && (
        <Text size="xs" c="dimmed">
          Sin propiedades: {empty.map((type) => type.label.toLowerCase()).join(', ')}.
        </Text>
      )}

      <Divider />

      <div>
        <Text size="xs" c="dimmed" mb={6}>
          Por operación (una con precio de venta y de alquiler cuenta en las dos)
        </Text>
        <Group justify="space-between" mb={6}>
          {operations.map((item) => (
            <Group key={item.key} gap={8}>
              <Box w={10} h={10} bg={item.color} style={{ borderRadius: 3 }} />
              <Text size="sm">
                {item.label}{' '}
                <Text span fw={600}>
                  {formatCount(item.value)}
                </Text>
              </Text>
            </Group>
          ))}
        </Group>
        <SplitBar segments={operations} />
      </div>
    </Stack>
  )
}

/** Un agente por renglón: leads con barra relativa al que más tiene, cierre y vencidos. */
function AgentTable({ agents }) {
  if (agents.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Ningún agente tiene leads ni avisos pendientes.
      </Text>
    )
  }

  const sorted = [...agents].sort((a, b) => b.leads - a.leads)
  const maxLeads = Math.max(1, ...sorted.map((agent) => agent.leads))

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Agente</Table.Th>
            <Table.Th w="35%">Leads</Table.Th>
            <Table.Th ta="right">Cerrados</Table.Th>
            <Table.Th ta="right">Avisos vencidos</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((agent) => (
            <Table.Tr key={agent.userId}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {agent.name ?? `Usuario #${agent.userId}`}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <Box style={{ flex: 1 }}>
                    <Box
                      h={10}
                      w={`${(agent.leads / maxLeads) * 100}%`}
                      miw={agent.leads > 0 ? 4 : 0}
                      bg={COLOR.primary}
                      style={{ borderRadius: '0 4px 4px 0' }}
                    />
                  </Box>
                  <Text size="sm" fw={600} w={28} ta="right">
                    {formatCount(agent.leads)}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm" span>
                  {formatCount(agent.closedLeads)}
                </Text>
                {agent.leads > 0 && (
                  <Text size="xs" c="dimmed" span>
                    {' '}
                    · {percent(agent.closedLeads, agent.leads)}%
                  </Text>
                )}
              </Table.Td>
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
 *
 * Cada dato tiene la forma que mejor lo cuenta: columnas para comparar
 * cantidades, dona y barra partida para las partes de un total.
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
              detail={`${data.crm.closeRate.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% de cierre`}
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
              label="Contratos vigentes"
              value={formatCount(data.contracts.byStatus.ACTIVE ?? 0)}
              detail={`de ${formatCount(data.contracts.total)} en total`}
            />
          </SimpleGrid>

          <Grid gutter="xl">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <ChartCard
                title="Embudo de leads"
                caption="Cuántos leads hay hoy en cada etapa, y cómo terminaron los que ya se cerraron."
              >
                <LeadPipeline crm={data.crm} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <ChartCard title="Ofertas" caption="Todas las ofertas cargadas en los leads, por estado.">
                <OfferBreakdown offersByStatus={data.crm.offersByStatus} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <ChartCard title="Contratos" caption="Por estado y por tipo, con lo que suman los vigentes.">
                <ContractBreakdown contracts={data.contracts} />
              </ChartCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <ChartCard title="Propiedades activas" caption="Por tipo, de la más cargada a la menos.">
                <PropertyBreakdown properties={data.properties} />
              </ChartCard>
            </Grid.Col>
          </Grid>

          <Card withBorder radius="lg" padding="lg" shadow="xs">
            <Title order={2} size="h5">
              Rendimiento por agente
            </Title>
            <Text size="xs" c="dimmed" mb="md">
              Un renglón por agente con leads o avisos pendientes, del que más leads tiene al que menos.
            </Text>
            <AgentTable agents={data.agents ?? []} />
          </Card>
        </Stack>
      )}
    </Container>
  )
}
