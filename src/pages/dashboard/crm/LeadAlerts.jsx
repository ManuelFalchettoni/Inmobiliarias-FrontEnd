import { useState } from 'react'
import { ActionIcon, Badge, Button, Group, Paper, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { IconCalendarEvent, IconCheck, IconCircleCheckFilled, IconTrash } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import {
  ALERT_STATUS,
  alertToRequest,
  completeAlert,
  createAlert,
  deleteAlert,
  updateAlert,
} from '../../../services/crm.js'
import { formatDateTime, toDateTimeInput, toLocalDateTime } from '../../../services/format.js'
import { findUser } from '../../../services/users.js'
import ConfirmAction from '../../../components/ConfirmAction.jsx'

/**
 * Mensaje, fecha y agente de un recordatorio. Lo usan "Agendar" (uno nuevo) y
 * "Reprogramar" (uno que ya existe): cambia de dónde salen los valores
 * iniciales y qué se hace al guardar (`onSubmit`, que recibe el body listo).
 */
function AlertForm({ initial, agents, submitLabel, onSubmit, onCancel }) {
  const [message, setMessage] = useState(initial.message)
  // Texto del <input type="datetime-local">: "2026-10-10T10:00".
  const [alertDate, setAlertDate] = useState(initial.alertDate)
  const [userId, setUserId] = useState(initial.userId)
  const [status, setStatus] = useState({ state: 'idle' })

  const submit = async (event) => {
    event.preventDefault()
    if (!message.trim() || !alertDate || !userId) {
      setStatus({ state: 'error', message: 'Complete el mensaje, la fecha y el agente.' })
      return
    }
    // Un recordatorio en el pasado nacería vencido: el backend lo acepta, pero
    // no tiene sentido agendarlo ni reprogramarlo así.
    if (new Date(alertDate).getTime() <= Date.now()) {
      setStatus({ state: 'error', message: 'Elegí una fecha y hora que todavía no pasó.' })
      return
    }

    setStatus({ state: 'saving' })
    try {
      await onSubmit({
        userId: Number(userId),
        message: message.trim(),
        // El backend espera "yyyy-MM-ddTHH:mm:ss": se le agregan los segundos.
        alertDate: toLocalDateTime(alertDate),
      })
      setStatus({ state: 'idle' })
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
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text size="sm" c="danger">
            {status.state === 'error' ? status.message : ''}
          </Text>
          <Group gap="xs" wrap="nowrap">
            {onCancel && (
              <Button variant="subtle" color="gray" size="compact-md" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" size="compact-md" loading={status.state === 'saving'}>
              {submitLabel}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  )
}

/** Un recordatorio nuevo: por defecto, para el agente del lead. Al guardar se vacía. */
function NewAlertForm({ lead, agents, onSaved }) {
  // `key` cambia después de cada alta: React arma el formulario de cero, vacío.
  const [formKey, setFormKey] = useState(0)

  return (
    <AlertForm
      key={formKey}
      initial={{ message: '', alertDate: '', userId: String(lead.userId) }}
      agents={agents}
      submitLabel="Agendar"
      onSubmit={async (request) => {
        // Sin estado: el backend la crea siempre en `PENDING`.
        await createAlert(lead.id, request)
        setFormKey((key) => key + 1)
        onSaved()
      }}
    />
  )
}

/**
 * Recordatorios del lead, la fecha más próxima primero. Una alerta vencida
 * (`expired`, lo calcula el backend) se marca en rojo; una cumplida, tachada.
 * Las pendientes se completan o se reprograman (fecha, mensaje o agente).
 */
export default function LeadAlerts({ lead, alerts, agents, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  // El recordatorio que se está reprogramando: uno a la vez.
  const [editingId, setEditingId] = useState(null)
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
        <Text size="sm" c="danger">
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
        const editing = editingId === alert.id

        return (
          <Paper
            key={alert.id}
            withBorder
            radius="md"
            p="sm"
            bg={done ? 'gray.0' : undefined}
            style={{
              opacity: busyId === alert.id ? 0.6 : 1,
              borderColor: overdue && !editing ? 'var(--mantine-color-danger-4)' : undefined,
            }}
          >
            {editing ? (
              <AlertForm
                initial={{
                  message: alert.message,
                  alertDate: toDateTimeInput(alert.alertDate),
                  userId: String(alert.userId),
                }}
                agents={agents}
                submitLabel="Guardar"
                onCancel={() => setEditingId(null)}
                onSubmit={async (request) => {
                  // PUT con los tres campos; el estado no cambia (sigue `PENDING`).
                  await updateAlert(lead.id, alert.id, alertToRequest(alert, request))
                  setEditingId(null)
                  onChanged()
                }}
              />
            ) : (
              <>
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
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
                      <Text size="xs" c={overdue ? 'danger' : 'dimmed'} fw={overdue ? 600 : undefined}>
                        {formatDateTime(alert.alertDate)}
                      </Text>
                      {overdue && (
                        <Badge size="xs" color="danger" variant="light">
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

                {/* Completar es de una sola vía: una alerta `DONE` no vuelve a `PENDING`. */}
                {done ? (
                  <Group gap={6} mt="xs" c="success.7">
                    <IconCircleCheckFilled size={16} />
                    <Text size="xs" fw={600}>
                      Cumplida
                    </Text>
                  </Group>
                ) : (
                  <Group gap="xs" mt="sm">
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="success"
                      leftSection={<IconCheck size={14} />}
                      disabled={busyId != null}
                      onClick={() => run(alert, () => completeAlert(lead.id, alert.id))}
                    >
                      Completar
                    </Button>
                    {/* En una vencida, reprogramar es lo más probable: se destaca. */}
                    <Button
                      size="compact-sm"
                      variant={overdue ? 'light' : 'subtle'}
                      color={overdue ? 'danger' : 'gray'}
                      leftSection={<IconCalendarEvent size={14} />}
                      disabled={busyId != null}
                      onClick={() => setEditingId(alert.id)}
                    >
                      Reprogramar
                    </Button>
                  </Group>
                )}
              </>
            )}
          </Paper>
        )
      })}
    </Stack>
  )
}
