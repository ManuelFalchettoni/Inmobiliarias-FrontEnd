import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  Select,
  SimpleGrid,
  Skeleton,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconAt, IconChevronRight, IconCircleCheck } from '@tabler/icons-react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { queryKeys } from '../../../queries/keys.js'
import { ApiError } from '../../../services/api.js'
import { formatCuit, normalizePhone } from '../../../services/agencies.js'
import {
  PEOPLE_CONFLICT_MESSAGE,
  PEOPLE_LIMITS,
  createPerson,
  findPerson,
  toPeopleFormValues,
  toPeopleRequest,
  updatePerson,
} from '../../../services/people.js'
import { peopleDefaultValues, peopleValidation } from './people-form.js'

const LIST_PATH = '/dashboard/personas'

function PageHeader({ personId }) {
  return (
    <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Container size="md" py="xl">
        <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
          <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
            Personas
          </Anchor>
          <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
            {personId ? `Persona #${personId}` : 'Nueva persona'}
          </Text>
        </Breadcrumbs>
        <Title order={1} size="h2" mb={4}>
          {personId ? 'Editar persona' : 'Alta de persona'}
        </Title>
        <Text c="dimmed">
          Clientes, interesados y propietarios. Una persona pertenece a una sola inmobiliaria; el
          DNI y el CUIT no se pueden repetir dentro de ella.
        </Text>
      </Container>
    </Box>
  )
}

/**
 * Formulario de alta y edición. `returnTo` permite volver a otra pantalla con
 * la persona creada: el alta de un lead manda acá cuando el cliente no existe.
 */
function PeopleEditor({ person, returnTo }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)
  const isEdit = person != null

  const initialValues = isEdit ? toPeopleFormValues(person) : peopleDefaultValues
  const agencies = useAgencyOptions(initialValues.agencyId)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues,
    validateInputOnBlur: true,
    validate: peopleValidation,
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'submitting' })

    try {
      const request = toPeopleRequest(values)
      const saved = isEdit
        ? await updatePerson(person.id, request, { signal: controller.signal })
        : await createPerson(request, { signal: controller.signal })

      // Marca como viejo todo lo de personas: el listado, el detalle y los
      // nombres que muestran el CRM y los contratos se vuelven a pedir.
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all })

      // Si se vino desde otra pantalla (un lead, un contrato, una propiedad), se
      // vuelve a ella con el id de la persona. Si la dirección ya tiene `?`, el
      // parámetro nuevo se agrega con `&`.
      if (returnTo) {
        navigate(`${returnTo}${returnTo.includes('?') ? '&' : '?'}peopleId=${saved.id}`)
        return
      }
      if (!isEdit) form.reset()
      setStatus({ state: 'saved', person: saved, created: !isEdit })
    } catch (error) {
      if (controller.signal.aborted) return

      // El 409 de personas no dice qué campo se repitió (lo controla la base de
      // datos), así que se marcan los dos candidatos: DNI y CUIT.
      if (error instanceof ApiError && error.isConflict) {
        form.setErrors({ dni: PEOPLE_CONFLICT_MESSAGE, cuit: PEOPLE_CONFLICT_MESSAGE })
        setStatus({ state: 'error', message: PEOPLE_CONFLICT_MESSAGE })
      } else if (error instanceof ApiError && error.hasFieldErrors) {
        form.setErrors(error.fieldErrors)
        setStatus({ state: 'error', message: error.message })
      } else {
        setStatus({ state: 'error', message: error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.' })
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)
  const isSubmitting = status.state === 'submitting'
  const dismiss = () => setStatus({ state: 'idle' })

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader personId={person?.id} />

      <Container size="md" py="xl">
        {status.state === 'saved' && (
          <Alert
            color="teal"
            icon={<IconCircleCheck />}
            title={status.created ? 'Persona creada' : 'Cambios guardados'}
            mb="lg"
            withCloseButton
            onClose={dismiss}
          >
            <b>{status.person.name}</b> quedó registrada con el identificador #{status.person.id}.{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Ver el listado
            </Anchor>
          </Alert>
        )}

        {status.state === 'error' && (
          <Alert
            color="red"
            icon={<IconAlertTriangle />}
            title={isEdit ? 'No se pudieron guardar los cambios' : 'No se pudo crear la persona'}
            mb="lg"
            withCloseButton
            onClose={dismiss}
          >
            {status.message}
          </Alert>
        )}

        <Card withBorder radius="lg" padding="xl" shadow="xs">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Inmobiliaria"
              placeholder={agencies.state === 'loading' ? 'Cargando inmobiliarias...' : 'Elegir'}
              description={
                isEdit
                  ? 'Una persona no cambia de inmobiliaria.'
                  : agencies.state === 'error'
                    ? `No se pudieron cargar: ${agencies.message}`
                    : undefined
              }
              data={agencies.options}
              searchable
              nothingFoundMessage="Sin coincidencias"
              disabled={isEdit || agencies.state === 'loading'}
              withAsterisk
              style={{ gridColumn: '1 / -1' }}
              key={form.key('agencyId')}
              {...form.getInputProps('agencyId')}
            />
            <TextInput
              label="Nombre y apellido"
              placeholder="Juan Pérez"
              withAsterisk
              maxLength={PEOPLE_LIMITS.name.max}
              key={form.key('name')}
              {...form.getInputProps('name')}
            />
            <TextInput
              label="Email"
              placeholder="juan@mail.com"
              type="email"
              leftSection={<IconAt size={16} />}
              withAsterisk
              maxLength={PEOPLE_LIMITS.email.max}
              key={form.key('email')}
              {...form.getInputProps('email')}
            />
            <TextInput
              label="Teléfono"
              placeholder="+5493415559876"
              type="tel"
              withAsterisk
              key={form.key('phone')}
              {...form.getInputProps('phone')}
              onBlur={(event) => {
                form.setFieldValue('phone', normalizePhone(event.currentTarget.value))
                form.validateField('phone')
              }}
            />
            <TextInput
              label="Dirección"
              placeholder="Opcional"
              maxLength={PEOPLE_LIMITS.address.max}
              key={form.key('address')}
              {...form.getInputProps('address')}
            />
            <TextInput
              label="DNI"
              placeholder="Opcional"
              inputMode="numeric"
              maxLength={PEOPLE_LIMITS.dni.max}
              key={form.key('dni')}
              {...form.getInputProps('dni')}
            />
            <TextInput
              label="CUIT"
              placeholder="Opcional"
              inputMode="numeric"
              maxLength={PEOPLE_LIMITS.cuit.max}
              key={form.key('cuit')}
              {...form.getInputProps('cuit')}
              onBlur={(event) => {
                form.setFieldValue('cuit', formatCuit(event.currentTarget.value))
                form.validateField('cuit')
              }}
            />
          </SimpleGrid>

          <Group justify="flex-end" mt="xl">
            <Button
              component={Link}
              to={returnTo ?? LIST_PATH}
              variant="subtle"
              color="gray"
              disabled={isSubmitting}
            >
              {returnTo ? 'Volver' : 'Volver al listado'}
            </Button>
            <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear persona'}
            </Button>
          </Group>
        </Card>
      </Container>
    </form>
  )
}

function PeopleLoader({ id }) {
  const query = useQuery({
    queryKey: queryKeys.people.detail(id),
    queryFn: ({ signal }) => findPerson(id, { signal }),
  })

  // Si ya hay datos se usan aunque falle una recarga en segundo plano (ver PropertyLoader).
  const result = query.data
    ? { person: query.data }
    : query.isError
      ? {
          error:
            query.error instanceof ApiError && query.error.status === 404
              ? `No existe una persona con el identificador #${id}.`
              : query.error.message,
        }
      : null

  if (!result || result.error) {
    return (
      <>
        <PageHeader personId={id} />
        <Container size="md" py="xl">
          {result?.error ? (
            <Alert color="red" icon={<IconAlertTriangle />} title="No se puede editar la persona">
              {result.error}{' '}
              <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
                Volver al listado
              </Anchor>
            </Alert>
          ) : (
            <Skeleton height={360} radius="lg" />
          )}
        </Container>
      </>
    )
  }

  return <PeopleEditor person={result.person} />
}

/**
 * Solo se aceptan rutas internas del panel como destino de vuelta. El valor
 * viene de la dirección (`?volver=...`) y cualquiera podría armar un link con
 * `?volver=https://sitio-malo.com`: aceptarlo sería un "open redirect".
 */
function safeReturnTo(value) {
  return value?.startsWith('/dashboard/') ? value : undefined
}

/** `/personas/nueva` y `/personas/:id/editar`. */
export default function PeopleForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('volver'))
  // Mismo patrón Loader + Editor que propiedades y agencias.
  return id ? <PeopleLoader key={id} id={id} /> : <PeopleEditor key="new" returnTo={returnTo} />
}
