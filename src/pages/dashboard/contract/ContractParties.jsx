import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ActionIcon, Alert, Button, Group, Paper, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconTrash, IconUserPlus } from '@tabler/icons-react'

import ConfirmAction from '../../../components/ConfirmAction.jsx'
import { useLookup } from '../../../hooks/useLookup.js'
import { usePeopleOptions } from '../../../hooks/useSelectOptions.js'
import { queryKeys } from '../../../queries/keys.js'
import { listAllOwners } from '../../../services/owners.js'
import { findPerson } from '../../../services/people.js'
import {
  CONTRACT_ROLE_LABEL,
  CONTRACT_ROLE_OPTIONS,
  ROLES_BY_TYPE,
  createParty,
  deleteParty,
  partyToRequest,
  toPartyRequest,
  updateParty,
} from '../../../services/contracts.js'

/** Roles que no pueden faltar para que el contrato esté completo. */
const REQUIRED_ROLES = { RENT: ['OWNER', 'TENANT'], SALE: ['OWNER', 'BUYER'] }

// Opciones de rol para el Select según el tipo de contrato (alquiler o venta).
// `canBeOwner` en false deshabilita "Propietario": la persona no es dueña de la propiedad.
function roleOptionsFor(type, current, canBeOwner = true) {
  const allowed = ROLES_BY_TYPE[type] ?? CONTRACT_ROLE_OPTIONS.map((o) => o.value)
  // Una parte cargada antes con otro rol igual tiene que mostrarlo.
  return CONTRACT_ROLE_OPTIONS.filter((o) => allowed.includes(o.value) || o.value === current).map((o) =>
    o.value === 'OWNER' && !canBeOwner && current !== 'OWNER' ? { ...o, disabled: true } : o,
  )
}

/**
 * Los dueños de la propiedad del contrato: solo ellos pueden ser Propietario
 * (el backend responde 400 con cualquier otra persona). Mismo pedido que la
 * edición de la propiedad (PropertyOwners): la lista entera, filtrada acá.
 */
function usePropertyOwners(propertyId) {
  const query = useQuery({
    queryKey: queryKeys.propertyOwners.all,
    queryFn: ({ signal }) => listAllOwners({ signal }),
    select: (owners) => owners.filter((owner) => owner.propertyId === Number(propertyId)),
  })
  const owners = query.data ?? []
  const people = useLookup('people', owners.map((o) => o.peopleId), findPerson)

  const options = owners.map((owner) => {
    const person = people[owner.peopleId]
    const label = person ? `${person.name} · ${person.phone}` : `Persona #${owner.peopleId}`
    return { value: String(owner.peopleId), label }
  })

  return {
    loaded: query.isSuccess,
    options,
    // ¿Esta persona es dueña? Mientras no se sabe, se deja pasar: el backend controla igual.
    isOwner: (peopleId) => !query.isSuccess || owners.some((o) => o.peopleId === Number(peopleId)),
  }
}

function NewPartyForm({ contract, owners, initialPeopleId, onSaved }) {
  const navigate = useNavigate()
  const people = usePeopleOptions(initialPeopleId)
  const [peopleId, setPeopleId] = useState(initialPeopleId)
  const [role, setRole] = useState(null)
  const [comments, setComments] = useState('')
  const [status, setStatus] = useState({ state: 'idle' })

  const ownerRole = role === 'OWNER'

  // Propietario usa otro Select (solo los dueños): al entrar o salir de ese rol
  // se empieza de cero, sin persona elegida ni texto de búsqueda.
  const changeRole = (newRole) => {
    if ((newRole === 'OWNER') !== ownerRole) {
      setPeopleId(null)
      people.searchProps.onSearchChange('')
    }
    setRole(newRole)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!peopleId || !role) {
      setStatus({ state: 'error', message: 'Elija la persona y su rol.' })
      return
    }
    setStatus({ state: 'saving' })
    try {
      await createParty(toPartyRequest(contract.id, { peopleId, role, comments }))
      setPeopleId(null)
      setRole(null)
      setComments('')
      setStatus({ state: 'idle' })
      onSaved()
    } catch (error) {
      setStatus({ state: 'error', message: error.message })
    }
  }

  // Alta de persona con vuelta al contrato, que llega con `?peopleId=`.
  const back = `/dashboard/contratos/${contract.id}`
  const newPersonLink = `/dashboard/personas/nueva?volver=${encodeURIComponent(back)}`

  return (
    <form onSubmit={submit}>
      <Stack gap="xs">
        <Group gap="xs" align="flex-start" grow>
          {ownerRole ? (
            // Propietario: solo los dueños cargados en la propiedad.
            <Select
              label="Persona"
              description="Solo los dueños de la propiedad"
              placeholder={
                !owners.loaded
                  ? 'Cargando dueños...'
                  : owners.options.length === 0
                    ? 'La propiedad no tiene dueños cargados'
                    : 'Elegir'
              }
              data={owners.options}
              value={peopleId}
              onChange={setPeopleId}
              searchable
              nothingFoundMessage="Sin coincidencias"
              disabled={owners.options.length === 0}
            />
          ) : (
            <Select
              label="Persona"
              placeholder={people.state === 'loading' ? 'Cargando personas...' : 'Elegir'}
              data={people.options}
              value={peopleId}
              onChange={setPeopleId}
              searchable
              {...people.searchProps}
              nothingFoundMessage="Sin coincidencias"
              disabled={people.state === 'loading'}
            />
          )}
          <Select
            label="Rol"
            placeholder="Elegir"
            data={roleOptionsFor(contract.type)}
            value={role}
            onChange={changeRole}
          />
        </Group>
        {ownerRole && owners.loaded && owners.options.length === 0 && (
          <Text size="sm" c="dimmed">
            Cargue los dueños en la{' '}
            <Link to={`/dashboard/propiedades/${contract.propertyId}/editar`}>edición de la propiedad</Link>.
          </Text>
        )}
        <TextInput
          label="Comentario"
          placeholder="Opcional: titular, 50%, garantía propietaria..."
          value={comments}
          onChange={(event) => setComments(event.currentTarget.value)}
        />
        <Group justify="space-between">
          <Button variant="subtle" size="compact-sm" leftSection={<IconUserPlus size={14} />} onClick={() => navigate(newPersonLink)}>
            No está en la lista: cargar persona nueva
          </Button>
          <Button type="submit" loading={status.state === 'saving'}>
            Agregar al contrato
          </Button>
        </Group>
        {status.state === 'error' && (
          <Text size="sm" c="danger">
            {status.message}
          </Text>
        )}
      </Stack>
    </form>
  )
}

/** Partes del contrato: quién participa y con qué rol. */
export default function ContractParties({ contract, parties, initialPeopleId, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const owners = usePropertyOwners(contract.propertyId)

  const run = async (party, work) => {
    setBusyId(party.id)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
      onChanged()
    }
  }

  // Roles que ya están cargados (un Set para preguntar rápido con `.has`) y,
  // de los imprescindibles para este tipo de contrato, cuáles faltan.
  const present = new Set(parties.map((p) => p.role))
  const missing = (REQUIRED_ROLES[contract.type] ?? []).filter((role) => !present.has(role))

  return (
    <Stack gap="md">
      {missing.length > 0 && (
        <Alert color="orange" icon={<IconAlertTriangle />} variant="light">
          Falta cargar: {missing.map((role) => CONTRACT_ROLE_LABEL[role].toLowerCase()).join(' y ')}.
        </Alert>
      )}

      {error && (
        <Text size="sm" c="danger">
          {error}
        </Text>
      )}

      {parties.map((party) => {
        // Cada parte llega con su persona: no hace falta pedirla aparte
        const person = party.person
        return (
          <Paper key={party.id} withBorder radius="md" p="sm" style={{ opacity: busyId === party.id ? 0.6 : 1 }}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div style={{ minWidth: 0 }}>
                <Text fw={500}>
                  {person ? (
                    <Link to={`/dashboard/personas/${person.id}/editar`} style={{ color: 'inherit' }}>
                      {person.name}
                    </Link>
                  ) : (
                    `Persona #${party.peopleId}`
                  )}
                </Text>
                {person && (
                  <Text size="xs" c="dimmed">
                    {[person.phone, person.email, person.dni && `DNI ${person.dni}`].filter(Boolean).join(' · ')}
                  </Text>
                )}
                {party.comments && (
                  <Text size="sm" mt={4}>
                    {party.comments}
                  </Text>
                )}
              </div>
              <Group gap="xs" wrap="nowrap">
                <Select
                  aria-label="Rol"
                  data={roleOptionsFor(contract.type, party.role, owners.isOwner(party.peopleId))}
                  value={party.role}
                  allowDeselect={false}
                  disabled={busyId != null}
                  w={140}
                  // Cambiar el rol guarda al instante. Con `&&` encadenados, el
                  // pedido solo se hace si hay rol y es distinto del actual.
                  onChange={(role) =>
                    role && role !== party.role && run(party, () => updateParty(party.id, partyToRequest(party, { role })))
                  }
                />
                <ConfirmAction
                  label="¿Quitar?"
                  disabled={busyId != null}
                  onConfirm={() => run(party, () => deleteParty(party.id))}
                >
                  {(props) => (
                    <ActionIcon variant="subtle" color="gray" aria-label="Quitar del contrato" {...props}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </ConfirmAction>
              </Group>
            </Group>
          </Paper>
        )
      })}

      <Paper withBorder radius="md" p="md" bg="gray.0">
        <NewPartyForm contract={contract} owners={owners} initialPeopleId={initialPeopleId} onSaved={onChanged} />
      </Paper>
    </Stack>
  )
}
