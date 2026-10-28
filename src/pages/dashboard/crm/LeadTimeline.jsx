import { useState } from 'react'
import { Button, Group, Select, Stack, Text, Textarea, ThemeIcon, Timeline } from '@mantine/core'
import {
  IconArrowsExchange,
  IconCash,
  IconMapPin,
  IconNote,
  IconPhone,
} from '@tabler/icons-react'

import { useAuth } from '../../../context/auth-context.js'
import { useLookup } from '../../../hooks/useLookup.js'
import { CRM_EVENT_LABEL, MANUAL_EVENT_OPTIONS, createHistoryEvent } from '../../../services/crm.js'
import { formatDateTime } from '../../../services/format.js'
import { USER_ROL, findUser } from '../../../services/users.js'

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

/**
 * Alta de un evento manual: nota, llamada o visita.
 *
 * A nombre de quién queda depende del rol: un agente solo puede firmar como sí
 * mismo (el Select va bloqueado); la inmobiliaria y el admin eligen entre los
 * usuarios. En los dos casos arranca elegido el usuario logueado.
 */
function NewEventForm({ lead, agents, onCreated }) {
  const { user } = useAuth()
  const canChooseUser = user.rol !== USER_ROL.AGENT
  const [type, setType] = useState('CALL')
  const [userId, setUserId] = useState(String(user.id))
  const [comments, setComments] = useState('')
  const [status, setStatus] = useState({ state: 'idle' })

  // El logueado tiene que estar siempre entre las opciones, aunque el listado
  // no lo traiga (un agente no ve a los demás, o quedó fuera del tope de 100).
  const ownOption = { value: String(user.id), label: `${user.name} (vos)` }
  const userOptions = canChooseUser
    ? [ownOption, ...agents.options.filter((option) => option.value !== ownOption.value)]
    : [ownOption]

  const submit = async (event) => {
    // Evita que el <form> recargue la página al enviarse.
    event.preventDefault()
    setStatus({ state: 'saving' })
    try {
      // Un agente firma siempre como sí mismo, aunque el estado diga otra cosa.
      const author = canChooseUser ? Number(userId) : user.id
      await createHistoryEvent(lead.id, { userId: author, type, comments: comments.trim() || null })
      setComments('')
      // El próximo evento vuelve a arrancar a nombre del logueado.
      setUserId(String(user.id))
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
          <Select
            label="A nombre de"
            data={userOptions}
            value={canChooseUser ? userId : ownOption.value}
            onChange={(value) => value && setUserId(value)}
            disabled={!canChooseUser}
            searchable
            allowDeselect={false}
            nothingFoundMessage="Sin coincidencias"
            style={{ flex: 1 }}
          />
        </Group>
        <Group align="flex-end" gap="sm" wrap="nowrap">
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
export default function LeadTimeline({ lead, history, agents, onChanged }) {
  const users = useLookup('users', history.map((event) => event.userId), findUser)

  return (
    <Stack gap="lg">
      <NewEventForm lead={lead} agents={agents} onCreated={onChanged} />

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
