import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconChevronRight, IconCircleCheck, IconUserPlus } from '@tabler/icons-react'

import { useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../../queries/keys.js'
import { usePeopleOptions, usePropertyOptions, useUserOptions } from '../../../hooks/useSelectOptions.js'
import { ApiError } from '../../../services/api.js'
import { CRM_STAGE_OPTIONS, createLead, toLeadRequest } from '../../../services/crm.js'

const LIST_PATH = '/dashboard/consultas'
const SELF_PATH = `${LIST_PATH}/nuevo`

const required = (message) => (value) => (value ? null : message)

/**
 * Placeholder y descripción comunes a los tres Select que cargan del backend.
 * Devuelve un objeto de props que se "desparrama" en cada Select con `{...}`.
 */
function optionProps(source, noun) {
  return {
    placeholder: source.state === 'loading' ? `Cargando ${noun}...` : 'Elegir',
    description: source.state === 'error' ? `No se pudieron cargar: ${source.message}` : undefined,
    data: source.options,
    disabled: source.state === 'loading',
    searchable: true,
    nothingFoundMessage: 'Sin coincidencias',
    withAsterisk: true,
  }
}

/** Alta de lead (`/dashboard/consultas/nuevo`): propiedad, interesado, agente y etapa. */
export default function LeadForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)

  // Al volver del alta de persona llega `peopleId`; desde una propiedad, `propertyId`.
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      propertyId: searchParams.get('propertyId'),
      peopleId: searchParams.get('peopleId'),
      userId: null,
      stage: 'NEW',
    },
    validate: {
      propertyId: required('Elija la propiedad.'),
      peopleId: required('Elija a la persona interesada.'),
      userId: required('Elija el agente que lo sigue.'),
      stage: required('Elija la etapa.'),
    },
  })

  // Se pasan los valores iniciales a los hooks: si la persona recién creada no
  // está en la lista de opciones, el hook la pide aparte para poder mostrarla.
  const initial = form.getInitialValues()
  const properties = usePropertyOptions(initial.propertyId)
  const people = usePeopleOptions(initial.peopleId)
  const users = useUserOptions(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'submitting' })

    try {
      const lead = await createLead(toLeadRequest(values), { signal: controller.signal })
      // Hay un lead más: el listado de leads se vuelve a pedir.
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      // Al detalle del lead nuevo, con el aviso "Lead creado".
      navigate(`${LIST_PATH}/${lead.id}`, { state: { created: true } })
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus({
        state: 'error',
        message:
          error instanceof ApiError && error.status === 404
            ? `${error.message}. La propiedad y el agente tienen que estar activos.`
            : error.message,
      })
    }
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)
  const isSubmitting = status.state === 'submitting'

  // La vuelta trae el `peopleId` nuevo; el resto del formulario se pierde,
  // así que se arma el regreso con la propiedad elegida para no perderla.
  const newPersonLink = () => {
    const back = new URLSearchParams()
    // getValues lee el valor actual del formulario no controlado en el momento del clic.
    const propertyId = form.getValues().propertyId
    if (propertyId) back.set('propertyId', propertyId)
    const volver = back.size > 0 ? `${SELF_PATH}?${back}` : SELF_PATH
    return `/dashboard/personas/nueva?volver=${encodeURIComponent(volver)}`
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="md" py="xl">
          <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
            <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
              Clientes & Leads
            </Anchor>
            <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
              Nuevo lead
            </Text>
          </Breadcrumbs>
          <Title order={1} size="h2" mb={4}>
            Nuevo lead
          </Title>
          <Text c="dimmed">
            Una persona interesada en una propiedad, con el agente que la va a seguir. Después se
            le cargan llamadas, visitas, ofertas y recordatorios.
          </Text>
        </Container>
      </Box>

      <Container size="md" py="xl">
        {status.state === 'error' && (
          <Alert
            color="red"
            icon={<IconAlertTriangle />}
            title="No se pudo crear el lead"
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            {status.message}
          </Alert>
        )}

        <Card withBorder radius="lg" padding="xl" shadow="xs">
          <Stack>
            <Select
              label="Propiedad"
              {...optionProps(properties, 'propiedades')}
              key={form.key('propertyId')}
              {...form.getInputProps('propertyId')}
            />
            <div>
              <Select
                label="Interesado"
                {...optionProps(people, 'personas')}
                key={form.key('peopleId')}
                {...form.getInputProps('peopleId')}
              />
              <Button
                // El link se arma al hacer clic: en modo no controlado elegir la
                // propiedad no re-renderiza, y un `to` fijo quedaría desactualizado.
                onClick={() => navigate(newPersonLink())}
                variant="subtle"
                size="compact-sm"
                mt={6}
                leftSection={<IconUserPlus size={14} />}
              >
                No está en la lista: cargar persona nueva
              </Button>
            </div>
            <Group grow align="flex-start">
              <Select
                label="Agente"
                {...optionProps(users, 'agentes')}
                key={form.key('userId')}
                {...form.getInputProps('userId')}
              />
              <Select
                label="Etapa"
                data={CRM_STAGE_OPTIONS}
                allowDeselect={false}
                withAsterisk
                key={form.key('stage')}
                {...form.getInputProps('stage')}
              />
            </Group>
          </Stack>

          <Group justify="flex-end" mt="xl">
            <Button component={Link} to={LIST_PATH} variant="subtle" color="gray" disabled={isSubmitting}>
              Volver al listado
            </Button>
            <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={isSubmitting}>
              Crear lead
            </Button>
          </Group>
        </Card>
      </Container>
    </form>
  )
}
