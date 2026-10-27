/**
 * Formularios de la cuenta de un usuario, compartidos por la edición desde el
 * panel (`/usuarios/:id/editar`) y por Configuración (`/configuracion`).
 *
 * Son dos formularios separados porque en el backend son dos pedidos distintos:
 * `PUT /api/users/{id}` (datos) y `PATCH /api/users/{id}/password` (contraseña).
 * Con `self`, la cuenta propia: `/api/users/me` y `/api/users/me/password`, que
 * puede usar cualquier rol (un USER no puede tocar `/api/users/{id}`).
 */
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconAt, IconCircleCheck, IconLock, IconUser } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../../queries/keys.js'
import { ApiError } from '../../../services/api.js'
import { formatCuit, normalizePhone } from '../../../services/agencies.js'
import {
  USER_LIMITS,
  toUserUpdateRequest,
  updateMe,
  updateMyPassword,
  updateUser,
  updateUserPassword,
} from '../../../services/users.js'
import { describeUserError, panelUserValidation, userValidation } from '../../auth/user-form.js'

/** El backend responde 400 con este mensaje cuando la contraseña actual no coincide. */
const WRONG_CURRENT_PASSWORD = 'current password does not match'

export function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card withBorder radius="lg" padding="xl" shadow="xs">
      <Group gap="sm" mb="lg" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" size={40} radius="md">
          <Icon size={22} />
        </ThemeIcon>
        <div>
          <Title order={2} size="h4">
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </div>
      </Group>
      {children}
    </Card>
  )
}

/**
 * Datos de la cuenta: nombre, email, teléfono, CUIT y matrícula. Es un
 * formulario propio, separado del de contraseña: son dos pedidos distintos en
 * el backend (PUT y PATCH) y cada uno se guarda y avisa por su cuenta.
 */
export function AccountCard({ user, onSaved, self = false }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: user.name ?? '',
      email: user.email ?? '',
      phoneNumber: user.phoneNumber ?? '',
      cuit: user.cuit ?? '',
      license: user.license ?? '',
    },
    validateInputOnBlur: true,
    // Reutiliza reglas sueltas del alta: solo las de los campos que se editan.
    validate: {
      name: userValidation.name,
      email: userValidation.email,
      phoneNumber: userValidation.phoneNumber,
      cuit: panelUserValidation.cuit,
      license: panelUserValidation.license,
    },
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'saving' })

    try {
      const request = toUserUpdateRequest(values)
      const options = { signal: controller.signal }
      const saved = self ? await updateMe(request, options) : await updateUser(user.id, request, options)
      // Marca como viejo todo lo de usuarios: el listado y los nombres que
      // muestran el CRM y otras pantallas se vuelven a pedir.
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      // Marca el formulario como "sin cambios" respecto de lo guardado.
      form.resetDirty()
      setStatus({ state: 'saved' })
      // Avisa al padre con el usuario actualizado (para el título de la página).
      onSaved(saved)
    } catch (error) {
      if (controller.signal.aborted) return
      const { message, fieldErrors } = describeUserError(error)
      if (Object.keys(fieldErrors).length > 0) form.setErrors(fieldErrors)
      setStatus({ state: 'error', message })
    }
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)

  return (
    <SectionCard icon={IconUser} title="Datos de la cuenta" description="Se guardan todos juntos.">
      {status.state === 'saved' && (
        <Alert color="teal" icon={<IconCircleCheck />} title="Cambios guardados" mb="md" withCloseButton onClose={() => setStatus({ state: 'idle' })} />
      )}
      {status.state === 'error' && (
        <Alert
          color="red"
          icon={<IconAlertTriangle />}
          title="No se pudieron guardar los cambios"
          mb="md"
          withCloseButton
          onClose={() => setStatus({ state: 'idle' })}
        >
          {status.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Nombre"
            description={`Entre ${USER_LIMITS.name.min} y ${USER_LIMITS.name.max} caracteres`}
            withAsterisk
            maxLength={USER_LIMITS.name.max}
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Email"
            type="email"
            leftSection={<IconAt size={16} />}
            withAsterisk
            maxLength={USER_LIMITS.email.max}
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <TextInput
            label="Teléfono"
            type="tel"
            description="Se guarda compacto, hasta 15 caracteres"
            withAsterisk
            key={form.key('phoneNumber')}
            {...form.getInputProps('phoneNumber')}
            onBlur={(event) => {
              form.setFieldValue('phoneNumber', normalizePhone(event.currentTarget.value))
              form.validateField('phoneNumber')
            }}
          />
          <TextInput
            label="CUIT"
            description="Opcional"
            inputMode="numeric"
            maxLength={USER_LIMITS.cuit.max}
            key={form.key('cuit')}
            {...form.getInputProps('cuit')}
            onBlur={(event) => {
              form.setFieldValue('cuit', formatCuit(event.currentTarget.value))
              form.validateField('cuit')
            }}
          />
          <TextInput
            label="Matrícula"
            description="Opcional"
            maxLength={USER_LIMITS.license.max}
            key={form.key('license')}
            {...form.getInputProps('license')}
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="xl">
          <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={status.state === 'saving'}>
            Guardar cambios
          </Button>
        </Group>
      </form>
    </SectionCard>
  )
}

/** Cambio de contraseña: `PATCH /password` con la actual y la nueva. */
export function PasswordCard({ user, self = false }) {
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { currentPassword: '', password: '', confirmPassword: '' },
    validate: {
      currentPassword: (value) => (value ? null : 'Indique la contraseña actual.'),
      // La regla del alta (8 a 20 caracteres) más una propia del cambio.
      password: (value, values) => {
        const error = userValidation.password(value)
        if (error) return error
        return value === values.currentPassword ? 'La nueva tiene que ser distinta de la actual.' : null
      },
      confirmPassword: userValidation.confirmPassword,
    },
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  // Desestructura solo los dos campos que viajan: `confirmPassword` se queda acá.
  const handleSubmit = async ({ currentPassword, password }) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'saving' })

    try {
      const request = { currentPassword, password }
      const options = { signal: controller.signal }
      if (self) await updateMyPassword(request, options)
      else await updateUserPassword(user.id, request, options)
      // Las contraseñas no quedan escritas en pantalla después de cambiarlas.
      form.reset()
      setStatus({ state: 'saved' })
    } catch (error) {
      if (controller.signal.aborted) return
      // El backend responde 400 con un mensaje fijo si la actual no coincide:
      // se reconoce ese texto y el error va al campo, no a un cartel general.
      if (error instanceof ApiError && String(error.message).toLowerCase().includes(WRONG_CURRENT_PASSWORD)) {
        form.setErrors({ currentPassword: 'La contraseña actual no es correcta.' })
        setStatus({ state: 'idle' })
        return
      }
      if (error instanceof ApiError && error.hasFieldErrors) form.setErrors(error.fieldErrors)
      setStatus({ state: 'error', message: error.message })
    }
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)

  return (
    <SectionCard
      icon={IconLock}
      title="Contraseña"
      description="Sin la contraseña actual no se cambia nada."
    >
      {status.state === 'saved' && (
        <Alert color="teal" icon={<IconCircleCheck />} title="Contraseña actualizada" mb="md" withCloseButton onClose={() => setStatus({ state: 'idle' })} />
      )}
      {status.state === 'error' && (
        <Alert
          color="red"
          icon={<IconAlertTriangle />}
          title="No se pudo cambiar la contraseña"
          mb="md"
          withCloseButton
          onClose={() => setStatus({ state: 'idle' })}
        >
          {status.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Stack>
          <PasswordInput
            label="Contraseña actual"
            autoComplete="current-password"
            withAsterisk
            maw={{ sm: 'calc(50% - var(--mantine-spacing-md) / 2)' }}
            key={form.key('currentPassword')}
            {...form.getInputProps('currentPassword')}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <PasswordInput
              label="Nueva contraseña"
              placeholder={`Entre ${USER_LIMITS.password.min} y ${USER_LIMITS.password.max} caracteres`}
              autoComplete="new-password"
              withAsterisk
              maxLength={USER_LIMITS.password.max}
              key={form.key('password')}
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label="Repetir la nueva"
              autoComplete="new-password"
              withAsterisk
              maxLength={USER_LIMITS.password.max}
              key={form.key('confirmPassword')}
              {...form.getInputProps('confirmPassword')}
            />
          </SimpleGrid>
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button type="submit" variant="light" leftSection={<IconLock size={18} />} loading={status.state === 'saving'}>
            Cambiar contraseña
          </Button>
        </Group>
      </form>
    </SectionCard>
  )
}
