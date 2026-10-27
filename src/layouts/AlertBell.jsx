import { Link } from 'react-router-dom'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconBell, IconCheck } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../context/auth-context.js'
import { useNow } from '../hooks/useNow.js'
import { queryKeys } from '../queries/keys.js'
import { alertToRequest, listUpcomingAlerts, updateAlert } from '../services/crm.js'
import { formatDateTime, formatTimeLeft } from '../services/format.js'
import { USER_ROL } from '../services/users.js'

/** Cuántos avisos entran en el desplegable; el resto, en la agenda. */
const MAX_VISIBLE = 8
/** La campanita se refresca sola cada minuto, aunque no se toque nada. */
const REFRESH_MS = 60 * 1000

/**
 * Campanita del encabezado: los avisos del CRM sin cumplir, de
 * `GET /api/crm_alerts/upcoming`. Un agente ve los suyos; la inmobiliaria y el
 * admin, los de todos sus leads. El número cuenta todos los pendientes y se
 * pone rojo si alguno ya venció.
 */
export default function AlertBell() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const now = useNow()
  const [opened, { toggle, close }] = useDisclosure(false)

  const params = user.rol === USER_ROL.AGENT ? { userId: user.id } : {}
  const query = useQuery({
    queryKey: queryKeys.leads.upcomingAlerts(params),
    queryFn: ({ signal }) => listUpcomingAlerts(params, { signal }),
    refetchInterval: REFRESH_MS,
  })

  // Marcar como cumplido: el mismo PUT que usa el detalle del lead. Al terminar
  // se invalida todo lo de leads: la campanita, la agenda y el detalle.
  const markRead = useMutation({
    mutationFn: (alert) =>
      updateAlert(alert.crmPropertyId, alert.id, alertToRequest(alert, { isRead: true })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.leads.all }),
  })

  const alerts = query.data ?? []
  const count = alerts.length
  const overdue = alerts.filter((alert) => new Date(alert.alertDate).getTime() <= now).length

  return (
    <Popover opened={opened} onChange={(next) => (next ? null : close())} width={380} position="bottom-end" shadow="md" radius="md">
      <Popover.Target>
        <Indicator
          label={count > 99 ? '99+' : count}
          size={18}
          offset={6}
          color={overdue > 0 ? 'red' : 'teal'}
          disabled={count === 0}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={toggle}
            aria-label={count ? `Avisos: ${count} pendientes` : 'Avisos: ninguno pendiente'}
          >
            <IconBell size={22} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Group justify="space-between" px="md" py="sm">
          <Text fw={600}>Avisos pendientes</Text>
          {overdue > 0 && (
            <Badge color="red" variant="light">
              {overdue} {overdue === 1 ? 'vencido' : 'vencidos'}
            </Badge>
          )}
        </Group>
        <Divider />

        {query.isPending && (
          <Text size="sm" c="dimmed" p="md">
            Cargando avisos...
          </Text>
        )}
        {query.isError && (
          <Text size="sm" c="red" p="md">
            No se pudieron cargar los avisos: {query.error.message}
          </Text>
        )}
        {query.isSuccess && count === 0 && (
          <Text size="sm" c="dimmed" p="md">
            No hay avisos pendientes.
          </Text>
        )}

        {count > 0 && (
          <ScrollArea.Autosize mah={360}>
            <Stack gap={0}>
              {alerts.slice(0, MAX_VISIBLE).map((alert) => {
                const left = new Date(alert.alertDate).getTime() - now
                return (
                  <Group key={alert.id} gap="xs" wrap="nowrap" px="md" py="xs" align="flex-start">
                    <UnstyledButton
                      component={Link}
                      to={`/dashboard/consultas/${alert.crmPropertyId}`}
                      onClick={close}
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Text size="sm" lineClamp={2}>
                        {alert.message}
                      </Text>
                      <Text size="xs" c={left <= 0 ? 'red' : 'dimmed'}>
                        {formatDateTime(alert.alertDate)} · {left <= 0 ? 'vencido' : `en ${formatTimeLeft(left)}`}
                      </Text>
                    </UnstyledButton>
                    <Tooltip label="Marcar como cumplido" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        aria-label={`Marcar como cumplido: ${alert.message}`}
                        loading={markRead.isPending && markRead.variables?.id === alert.id}
                        onClick={() => markRead.mutate(alert)}
                      >
                        <IconCheck size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )
              })}
            </Stack>
          </ScrollArea.Autosize>
        )}

        {markRead.isError && (
          <Text size="xs" c="red" px="md" pb="xs">
            No se pudo marcar: {markRead.error.message}
          </Text>
        )}

        <Divider />
        <Box p="xs">
          <Button component={Link} to="/dashboard/avisos" onClick={close} variant="subtle" fullWidth>
            {count > MAX_VISIBLE ? `Ver los ${count} en la agenda` : 'Ver la agenda de avisos'}
          </Button>
        </Box>
      </Popover.Dropdown>
    </Popover>
  )
}
