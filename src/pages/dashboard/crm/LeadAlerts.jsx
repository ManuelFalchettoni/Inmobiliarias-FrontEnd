import { useState } from 'react'
import { ActionIcon, Badge, Button, Checkbox, Group, Paper, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { alertToRequest, createAlert, deleteAlert, updateAlert } from '../../../services/crm.js'
import { formatDateTime, toLocalDateTime } from '../../../services/format.js'
import { findUser } from '../../../services/users.js'
import ConfirmAction from './ConfirmAction.jsx'

function NewAlertForm({ lead, agents, onSaved }) {
  const [message, setMessage] = useState('')
  const [alertDate, setAlertDate] = useState('')
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
        alertDate: toLocalDateTime(alertDate),
        isRead: false,
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
 * Recordatorios del lead, la fecha más próxima primero. Una alerta vencida y
 * sin leer se marca en rojo.
 */
export default function LeadAlerts({ lead, alerts, agents, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const users = useLookup('users', alerts.map((alert) => alert.userId), findUser)
  // Una sola lectura del reloj por render: alcanza para marcar las vencidas.
  const [now] = useState(() => Date.now())

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
        const overdue = !alert.isRead && new Date(alert.alertDate).getTime() < now

        return (
          <Paper
            key={alert.id}
            withBorder
            radius="md"
            p="sm"
            bg={alert.isRead ? 'gray.0' : undefined}
            style={{
              opacity: busyId === alert.id ? 0.6 : 1,
              borderColor: overdue ? 'var(--mantine-color-red-4)' : undefined,
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <Checkbox
                checked={alert.isRead}
                disabled={busyId != null}
                aria-label={alert.isRead ? 'Marcar como pendiente' : 'Marcar como cumplida'}
                onChange={(event) => {
                  const isRead = event.currentTarget.checked
                  run(alert, () => updateAlert(lead.id, alert.id, alertToRequest(alert, { isRead })))
                }}
                mt={2}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" td={alert.isRead ? 'line-through' : undefined} style={{ whiteSpace: 'pre-wrap' }}>
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
