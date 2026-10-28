import { useState } from 'react'
import { ActionIcon, Badge, Button, Group, Paper, Select, Stack, Text, TextInput, Textarea, Tooltip } from '@mantine/core'
import { IconCircleCheck, IconTrash } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { ALERT_STATUS, completeAlert, createAlert, deleteAlert } from '../../../services/crm.js'
import { formatDateTime, toLocalDateTime } from '../../../services/format.js'
import { findUser } from '../../../services/users.js'
import ConfirmAction from '../../../components/ConfirmAction.jsx'

function NewAlertForm({ lead, agents, onSaved }) {
  const [message, setMessage] = useState('')
  // Texto del <input type="datetime-local">: "2026-10-10T10:00".
  const [alertDate, setAlertDate] = useState('')
  // Por defecto, el recordatorio es para el agente del lead.
  const [userId, setUserId] = useState(String(lead.userId))
  const [status, setStatus] = useState({ state: 'idle' })

  const submit = async (event) => {
    event.preventDefault()
    if (!message.trim() || !alertDate || !userId) {
      setStatus({ state: 'error', message: 'Complete el mensaje, la fecha y el agente.' })
      return
    }

    setStatus({ state: 'saving' })
    try {
      await createAlert(lead.id, {
        userId: Number(userId),
        message: message.trim(),
        // El backend espera "yyyy-MM-ddTHH:mm:ss": se le agregan los segundos.
        // Sin estado: el backend la crea siempre en `PENDING`.
        alertDate: toLocalDateTime(alertDate),
      })
      setMessage('')
      setAlertDate('')
      setStatus({ state: 'idle' })
      onSaved()
    } catch (error) {
      setStatus({ state: 'error', message: error.message })
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="xs">
        <Textarea
          aria-label="Mensaje del recordatorio"
          placeholder="Llamar para confirmar la visita"
          autosize
          minRows={1}
          maxRows={3}
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
        <Group gap="xs" grow>
          <TextInput
            aria-label="Fecha y hora"
            type="datetime-local"
            value={alertDate}
            onChange={(event) => setAlertDate(event.currentTarget.value)}
          />
          <Select
            aria-label="Agente que recibe el recordatorio"
            data={agents.options}
            value={userId}
            onChange={setUserId}
            searchable
            allowDeselect={false}
          />
        </Group>
        <Group justify="space-between" align="center">
          <Text size="sm" c="red">
            {status.state === 'error' ? status.message : ''}
          </Text>
          <Button type="submit" size="compact-md" loading={status.state === 'saving'}>
            Agendar
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

/**
 * Recordatorios del lead, la fecha más próxima primero. Una alerta vencida
 * (`expired`, lo calcula el backend) se marca en rojo; una cumplida, tachada.
 */
export default function LeadAlerts({ lead, alerts, agents, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const users = useLookup('users', alerts.map((alert) => alert.userId), findUser)

  const run = async (alert, action) => {
    setBusyId(alert.id)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
      onChanged()
    }
  }

  return (
    <Stack gap="sm">
      <NewAlertForm lead={lead} agents={agents} onSaved={onChanged} />

      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      {alerts.length === 0 && (
        <Text size="sm" c="dimmed">
          Sin recordatorios.
        </Text>
      )}

      {alerts.map((alert) => {
        const done = alert.status === ALERT_STATUS.DONE
        // Vencida: pendiente y con la fecha ya pasada. Lo decide el backend.
        const overdue = alert.expired

        return (
          <Paper
            key={alert.id}
            withBorder
            radius="md"
            p="sm"
            bg={done ? 'gray.0' : undefined}
            style={{
              opacity: busyId === alert.id ? 0.6 : 1,
              borderColor: overdue ? 'var(--mantine-color-red-4)' : undefined,
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              {/* Completar es de una sola vía: una alerta `DONE` no vuelve a `PENDING`. */}
              <Tooltip label={done ? 'Cumplida' : 'Completar'} withArrow>
                <ActionIcon
                  variant={done ? 'filled' : 'light'}
                  color="teal"
                  radius="xl"
                  disabled={done || busyId != null}
                  aria-label={done ? 'Recordatorio cumplido' : 'Completar recordatorio'}
                  onClick={() => run(alert, () => completeAlert(lead.id, alert.id))}
                >
                  <IconCircleCheck size={18} />
                </ActionIcon>
              </Tooltip>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text
                  size="sm"
                  td={done ? 'line-through' : undefined}
                  c={done ? 'dimmed' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {alert.message}
                </Text>
                <Group gap={6} mt={4}>
                  <Text size="xs" c={overdue ? 'red' : 'dimmed'} fw={overdue ? 600 : undefined}>
                    {formatDateTime(alert.alertDate)}
                  </Text>
                  {overdue && (
                    <Badge size="xs" color="red" variant="light">
                      Vencida
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  Para {users[alert.userId]?.name ?? `usuario #${alert.userId}`}
                </Text>
              </div>
              <ConfirmAction
                label="¿Borrar?"
                disabled={busyId != null}
                onConfirm={() => run(alert, () => deleteAlert(lead.id, alert.id))}
              >
                {(props) => (
                  <ActionIcon variant="subtle" color="gray" aria-label="Borrar recordatorio" {...props}>
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </ConfirmAction>
            </Group>
          </Paper>
        )
      })}
    </Stack>
  )
}
