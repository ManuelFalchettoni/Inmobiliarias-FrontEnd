import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Group, Select, SimpleGrid, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useQueryClient } from '@tanstack/react-query'
import { IconAlertTriangle, IconAt, IconCircleCheck, IconInfoCircle, IconUserPlus } from '@tabler/icons-react'

import { useAuth } from '../../../context/auth-context.js'
import { defaultAgencyId, useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
import { queryKeys } from '../../../queries/keys.js'
import { ApiError } from '../../../services/api.js'
import {
  JOIN_AGENCY_ROL_OPTIONS,
  USER_ROL,
  USER_ROL_LABEL,
  joinAgency,
  toJoinAgencyRequest,
} from '../../../services/users.js'
import { userValidation } from '../../auth/user-form.js'

/**
 * Traduce los errores de `UserJoinAgencyService` a `{ message, fieldErrors }`.
 * Los 404 traen "User not found..." o "Agency..."; el 409, que ya tiene agencia.
 */
function describeJoinError(error) {
  if (!(error instanceof ApiError)) {
    return { message: 'Ocurrió un error inesperado al sumar la cuenta.', fieldErrors: {} }
  }
  const text = String(error.message ?? '').toLowerCase()
  if (error.status === 404 && text.startsWith('user')) {
    const message = 'No hay ninguna cuenta activa registrada con este email.'
    return { message, fieldErrors: { email: message } }
  }
  if (error.status === 404) {
    const message = 'La inmobiliaria elegida no existe o está dada de baja.'
    return { message, fieldErrors: { agencyId: message } }
  }
  if (error.isConflict) {
    const message = 'Esta cuenta ya pertenece a una inmobiliaria.'
    return { message, fieldErrors: { email: message } }
  }
  return { message: error.message, fieldErrors: error.fieldErrors ?? {} }
}

const validation = {
  email: userValidation.email,
  rol: (value) => (value ? null : 'Elija el rol.'),
  agencyId: (value) => (value ? null : 'Elija la inmobiliaria.'),
}

/**
 * Suma a una inmobiliaria a alguien que ya se registró solo (rol USER, sin
 * agencia), con `POST /api/users/join-agency`: se lo busca por email y se le
 * da el rol AGENT o AGENCY. Conserva su nombre, teléfono y contraseña.
 */
export default function JoinAgencyForm() {
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  // AGENCY suma siempre a la suya (el backend ignora otra); el admin elige.
  const initialAgencyId = defaultAgencyId(me)
  const agencies = useAgencyOptions(initialAgencyId)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', rol: USER_ROL.AGENT, agencyId: initialAgencyId },
    validateInputOnBlur: true,
    validate: validation,
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'submitting' })

    try {
      const user = await joinAgency(toJoinAgencyRequest(values), { signal: controller.signal })
      // El listado de usuarios ahora tiene que mostrarlo en la inmobiliaria.
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      form.reset()
      setStatus({ state: 'joined', user })
    } catch (error) {
      if (controller.signal.aborted) return
      const { message, fieldErrors } = describeJoinError(error)
      const fields = Object.keys(fieldErrors)
      if (fields.length > 0) {
        form.setErrors(fieldErrors)
        form.getInputNode(fields[0])?.focus({ preventScroll: true })
      }
      setStatus({ state: 'error', message })
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)
  const isSubmitting = status.state === 'submitting'

  return (
    <form onSubmit={onSubmit} noValidate>
      {status.state === 'joined' && (
        <Alert
          color="success"
          icon={<IconCircleCheck />}
          title="Cuenta sumada"
          mb="lg"
          withCloseButton
          onClose={() => setStatus({ state: 'idle' })}
        >
          <b>{status.user?.name}</b> ({status.user?.email}) ya es parte de la inmobiliaria con rol{' '}
          <b>{USER_ROL_LABEL[status.user?.rol] ?? status.user?.rol}</b>. No necesita volver a iniciar sesión.
        </Alert>
      )}

      {status.state === 'error' && (
        <Alert
          color="danger"
          icon={<IconAlertTriangle />}
          title="No se pudo sumar la cuenta"
          mb="lg"
          withCloseButton
          onClose={() => setStatus({ state: 'idle' })}
        >
          {status.message}
        </Alert>
      )}

      <Card withBorder radius="lg" padding="xl">
        <Alert color="blue" variant="light" icon={<IconInfoCircle />} mb="lg">
          <Text size="sm">
            Para alguien que ya creó su cuenta en la página: pídale el email con el que se registró. Conserva
            sus datos y su contraseña; solo cambian su rol y su inmobiliaria, y no se pueden volver a cambiar.
          </Text>
        </Alert>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Email de la cuenta"
            placeholder="maria@mail.com"
            type="email"
            leftSection={<IconAt size={16} />}
            withAsterisk
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <Select
            label="Rol"
            description="Con qué permisos entra al panel"
            data={JOIN_AGENCY_ROL_OPTIONS}
            allowDeselect={false}
            withAsterisk
            key={form.key('rol')}
            {...form.getInputProps('rol')}
          />
          <Select
            label="Inmobiliaria"
            placeholder={agencies.state === 'loading' ? 'Cargando inmobiliarias...' : 'Elegir'}
            description={
              agencies.locked
                ? 'La cuenta se suma a tu inmobiliaria'
                : agencies.state === 'error'
                  ? `No se pudieron cargar: ${agencies.message}`
                  : 'La agencia a la que se suma la cuenta'
            }
            data={agencies.options}
            searchable
            nothingFoundMessage="Sin coincidencias"
            disabled={agencies.locked || agencies.state === 'loading'}
            withAsterisk
            style={{ gridColumn: '1 / -1' }}
            key={form.key('agencyId')}
            {...form.getInputProps('agencyId')}
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" color="gray" onClick={() => form.reset()} disabled={isSubmitting}>
            Limpiar
          </Button>
          <Button type="submit" leftSection={<IconUserPlus size={18} />} loading={isSubmitting}>
            Sumar a la inmobiliaria
          </Button>
        </Group>
      </Card>
    </form>
  )
}
