import { useState } from 'react'
import { Button, Group, Select, Stack, Text, Textarea, ThemeIcon, Timeline } from '@mantine/core'
import {
  IconArrowsExchange,
  IconCash,
  IconMapPin,
  IconNote,
  IconPhone,
} from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { CRM_EVENT_LABEL, MANUAL_EVENT_OPTIONS, createHistoryEvent } from '../../../services/crm.js'
import { formatDateTime } from '../../../services/format.js'
import { findUser } from '../../../services/users.js'

// Ícono y color de cada tipo de evento. Guardar componentes en un objeto
// permite elegir cuál dibujar según un dato: `const Icon = EVENT_ICON[type]`.
const EVENT_ICON = {
  NOTE: IconNote,
  CALL: IconPhone,
  VISIT: IconMapPin,
  OFFER: IconCash,
  STAGE_CHANGE: IconArrowsExchange,
}

const EVENT_COLOR = { NOTE: 'gray', CALL: 'blue', VISIT: 'grape', OFFER: 'orange', STAGE_CHANGE: 'teal' }

/** Alta de un evento manual: nota, llamada o visita. */
function NewEventForm({ lead, onCreated }) {
  const [type, setType] = useState('CALL')
  const [comments, setComments] = useState('')
  const [status, setStatus] = useState({ state: 'idle' })

  const submit = async (event) => {
    // Evita que el <form> recargue la página al enviarse.
    event.preventDefault()
    setStatus({ state: 'saving' })
    try {
      // Sin login todavía, el evento lo firma el agente asignado al lead.
      await createHistoryEvent(lead.id, { userId: lead.userId, type, comments: comments.trim() || null })
      setComments('')
      setStatus({ state: 'idle' })
      onCreated()
    } catch (error) {
      setStatus({ state: 'error', message: error.message })
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="xs">
        <Group align="flex-end" gap="sm" wrap="nowrap">
          <Select
            label="Registrar"
            data={MANUAL_EVENT_OPTIONS}
            value={type}
            onChange={(value) => value && setType(value)}
            allowDeselect={false}
            w={150}
          />
          <Textarea
            label="Comentario"
            placeholder="Quiere visitar el sábado"
            autosize
            minRows={1}
            maxRows={4}
            value={comments}
            onChange={(event) => setComments(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" loading={status.state === 'saving'}>
            Guardar
          </Button>
        </Group>
        {status.state === 'error' && (
          <Text size="sm" c="red">
            {status.message}
          </Text>
        )}
      </Stack>
    </form>
  )
}

/** Línea de tiempo del lead, lo más nuevo arriba. Los eventos no se editan. */
export default function LeadTimeline({ lead, history, onChanged }) {
  const users = useLookup('users', history.map((event) => event.userId), findUser)

  return (
    <Stack gap="lg">
      <NewEventForm lead={lead} onCreated={onChanged} />

      {history.length === 0 ? (
        <Text size="sm" c="dimmed">
          Todavía no hay eventos. Registre la primera llamada o visita.
        </Text>
      ) : (
        <Timeline bulletSize={28} lineWidth={2}>
          {/* El backend ya manda el historial ordenado, lo más nuevo primero. */}
          {history.map((event) => {
            // Variable con mayúscula para poder dibujarla como componente: <Icon />.
            const Icon = EVENT_ICON[event.type] ?? IconNote
            return (
              <Timeline.Item
                key={event.id}
                bullet={
                  <ThemeIcon size={28} radius="xl" variant="light" color={EVENT_COLOR[event.type]}>
                    <Icon size={15} />
                  </ThemeIcon>
                }
                title={CRM_EVENT_LABEL[event.type] ?? event.type}
              >
                {event.comments && (
                  // `pre-wrap` respeta los saltos de línea que se escribieron en el comentario.
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {event.comments}
                  </Text>
                )}
                <Text size="xs" c="dimmed" mt={4}>
                  {formatDateTime(event.createdAt)} · {users[event.userId]?.name ?? `Usuario #${event.userId}`}
                </Text>
              </Timeline.Item>
            )
          })}
        </Timeline>
      )}
    </Stack>
  )
}
