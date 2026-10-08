import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionIcon, Alert, Button, Group, Paper, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconTrash, IconUserPlus } from '@tabler/icons-react'

import ConfirmAction from '../../../components/ConfirmAction.jsx'
import { useLookup } from '../../../hooks/useLookup.js'
import { usePeopleOptions } from '../../../hooks/useSelectOptions.js'
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
import { findPerson } from '../../../services/people.js'

/** Roles que no pueden faltar para que el contrato esté completo. */
const REQUIRED_ROLES = { RENT: ['OWNER', 'TENANT'], SALE: ['OWNER', 'BUYER'] }

function roleOptionsFor(type, current) {
  const allowed = ROLES_BY_TYPE[type] ?? CONTRACT_ROLE_OPTIONS.map((o) => o.value)
  // Una parte cargada antes con otro rol igual tiene que mostrarlo.
  return CONTRACT_ROLE_OPTIONS.filter((o) => allowed.includes(o.value) || o.value === current)
}

function NewPartyForm({ contract, initialPeopleId, onSaved }) {
  const navigate = useNavigate()
  const people = usePeopleOptions(initialPeopleId)
  const [peopleId, setPeopleId] = useState(initialPeopleId)
  const [role, setRole] = useState(null)
  const [comments, setComments] = useState('')
  const [status, setStatus] = useState({ state: 'idle' })

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
          <Select
            label="Rol"
            placeholder="Elegir"
            data={roleOptionsFor(contract.type)}
            value={role}
            onChange={setRole}
          />
        </Group>
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
          <Text size="sm" c="red">
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
  const people = useLookup('people', parties.map((p) => p.peopleId), findPerson)

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
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      {parties.map((party) => {
        const person = people[party.peopleId]
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
                  data={roleOptionsFor(contract.type, party.role)}
                  value={party.role}
                  allowDeselect={false}
                  disabled={busyId != null}
                  w={140}
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
        <NewPartyForm contract={contract} initialPeopleId={initialPeopleId} onSaved={onChanged} />
      </Paper>
    </Stack>
  )
}
