import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionIcon, Button, Group, Paper, Select, Skeleton, Stack, Text, TextInput } from '@mantine/core'
import { IconCheck, IconPencil, IconTrash, IconUserPlus, IconX } from '@tabler/icons-react'

import ConfirmAction from '../../../components/ConfirmAction.jsx'
import { useLookup } from '../../../hooks/useLookup.js'
import { usePeopleOptions } from '../../../hooks/useSelectOptions.js'
import { ApiError } from '../../../services/api.js'
import {
  createOwner,
  deleteOwner,
  listPropertyOwners,
  ownerToRequest,
  toOwnerRequest,
  updateOwner,
} from '../../../services/owners.js'
import { findPerson } from '../../../services/people.js'

/** El backend exige un comentario en cada vínculo (`@NotBlank`). */
const COMMENT_HINT = 'Titular, co-titular, 50%...'

function NewOwnerForm({ propertyId, initialPeopleId, onSaved }) {
  const navigate = useNavigate()
  const people = usePeopleOptions(initialPeopleId)
  const [peopleId, setPeopleId] = useState(initialPeopleId)
  const [comments, setComments] = useState('')
  const [status, setStatus] = useState({ state: 'idle' })

  const submit = async () => {
    if (!peopleId || !comments.trim()) {
      setStatus({ state: 'error', message: 'Elija la persona y escriba un comentario.' })
      return
    }
    setStatus({ state: 'saving' })
    try {
      await createOwner(toOwnerRequest(propertyId, { peopleId, comments }))
      setPeopleId(null)
      setComments('')
      setStatus({ state: 'idle' })
      onSaved()
    } catch (error) {
      setStatus({
        state: 'error',
        message:
          error instanceof ApiError && error.isConflict
            ? 'Esa persona ya figura como dueña de esta propiedad.'
            : error.message,
      })
    }
  }

  // El alta de persona vuelve al editor con `?peopleId=`.
  const back = `/dashboard/propiedades/${propertyId}/editar`
  const newPersonLink = `/dashboard/personas/nueva?volver=${encodeURIComponent(back)}`

  // Sin <form>: esta sección vive dentro del formulario de la propiedad, y un
  // form anidado no es HTML válido. Enter en el comentario dispara el alta.
  return (
    <Stack gap="xs">
      <Group gap="xs" align="flex-start" grow>
        <Select
          label="Persona"
          placeholder={people.state === 'loading' ? 'Cargando personas...' : 'Elegir'}
          data={people.options}
          value={peopleId}
          onChange={setPeopleId}
          searchable
          nothingFoundMessage="Sin coincidencias"
          disabled={people.state === 'loading'}
        />
        <TextInput
          label="Comentario"
          placeholder={COMMENT_HINT}
          value={comments}
          onChange={(event) => setComments(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
      </Group>
      <Group justify="space-between">
        <Button variant="subtle" size="compact-sm" leftSection={<IconUserPlus size={14} />} onClick={() => navigate(newPersonLink)}>
          No está en la lista: cargar persona nueva
        </Button>
        <Button onClick={submit} loading={status.state === 'saving'}>
          Agregar dueño
        </Button>
      </Group>
      {status.state === 'error' && (
        <Text size="sm" c="red">
          {status.message}
        </Text>
      )}
    </Stack>
  )
}

/** Comentario editable en línea. */
function OwnerComment({ owner, disabled, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(owner.comments ?? '')

  if (!editing) {
    return (
      <Group gap={4} wrap="nowrap">
        <Text size="sm" c={owner.comments ? undefined : 'dimmed'}>
          {owner.comments || 'Sin comentario'}
        </Text>
        <ActionIcon variant="subtle" size="sm" disabled={disabled} aria-label="Editar comentario" onClick={() => setEditing(true)}>
          <IconPencil size={14} />
        </ActionIcon>
      </Group>
    )
  }

  const save = () => {
    if (!value.trim()) return
    setEditing(false)
    onSave(value.trim())
  }

  return (
    <Group gap={4} wrap="nowrap">
      <TextInput
        size="xs"
        value={value}
        placeholder={COMMENT_HINT}
        autoFocus
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            save()
          }
          if (event.key === 'Escape') setEditing(false)
        }}
        error={!value.trim()}
      />
      <ActionIcon variant="subtle" color="teal" size="sm" aria-label="Guardar comentario" onClick={save}>
        <IconCheck size={14} />
      </ActionIcon>
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Descartar" onClick={() => setEditing(false)}>
        <IconX size={14} />
      </ActionIcon>
    </Group>
  )
}

/**
 * Dueños de la propiedad. Se guardan al instante, aparte del botón "Guardar
 * cambios" del formulario: cada vínculo es su propio recurso en el backend.
 */
export default function PropertyOwners({ propertyId, initialPeopleId }) {
  const [version, setVersion] = useState(0)
  const [data, setData] = useState(null) // { owners } | { error }
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    listPropertyOwners(propertyId, { signal: controller.signal })
      .then((owners) => setData({ owners }))
      .catch((err) => {
        if (!controller.signal.aborted) setData((current) => ({ ...current, error: err.message }))
      })
    return () => controller.abort()
  }, [propertyId, version])

  const owners = data?.owners ?? []
  const people = useLookup('people', owners.map((o) => o.peopleId), findPerson)
  const reload = () => setVersion((v) => v + 1)

  const run = async (owner, work) => {
    setBusyId(owner.id)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
      reload()
    }
  }

  if (!data) return <Skeleton height={120} radius="md" />

  return (
    <Stack gap="sm">
      {data.error && (
        <Text size="sm" c="red">
          No se pudieron cargar los dueños: {data.error}
        </Text>
      )}
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      {owners.length === 0 && !data.error && (
        <Text size="sm" c="dimmed">
          Todavía no tiene dueños cargados.
        </Text>
      )}

      {owners.map((owner) => {
        const person = people[owner.peopleId]
        return (
          <Paper key={owner.id} withBorder radius="md" p="sm" style={{ opacity: busyId === owner.id ? 0.6 : 1 }}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div style={{ minWidth: 0 }}>
                <Text fw={500}>
                  {person ? (
                    <Link to={`/dashboard/personas/${person.id}/editar`} style={{ color: 'inherit' }}>
                      {person.name}
                    </Link>
                  ) : (
                    `Persona #${owner.peopleId}`
                  )}
                </Text>
                {person && (
                  <Text size="xs" c="dimmed">
                    {[person.phone, person.email, person.dni && `DNI ${person.dni}`].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <OwnerComment
                  owner={owner}
                  disabled={busyId != null}
                  onSave={(comments) => run(owner, () => updateOwner(owner.id, ownerToRequest(owner, { comments })))}
                />
              </div>
              <ConfirmAction label="¿Quitar?" disabled={busyId != null} onConfirm={() => run(owner, () => deleteOwner(owner.id))}>
                {(props) => (
                  <ActionIcon variant="subtle" color="gray" aria-label="Quitar como dueño" {...props}>
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </ConfirmAction>
            </Group>
          </Paper>
        )
      })}

      <Paper withBorder radius="md" p="md" bg="gray.0">
        <NewOwnerForm propertyId={propertyId} initialPeopleId={initialPeopleId} onSaved={reload} />
      </Paper>
    </Stack>
  )
}
