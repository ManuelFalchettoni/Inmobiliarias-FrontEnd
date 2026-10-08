import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  PasswordInput,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertTriangle,
  IconAt,
  IconChevronRight,
  IconCircleCheck,
  IconLock,
  IconUser,
} from '@tabler/icons-react'

import { forgetCached, useLookup } from '../../../hooks/useLookup.js'
import { ApiError } from '../../../services/api.js'
import { findAgency, formatCuit, normalizePhone } from '../../../services/agencies.js'
import {
  USER_LIMITS,
  USER_ROL_COLOR,
  USER_ROL_LABEL,
  findUser,
  toUserUpdateRequest,
  updateUser,
  updateUserPassword,
} from '../../../services/users.js'
import { describeUserError, panelUserValidation, userValidation } from '../../auth/user-form.js'

const LIST_PATH = '/dashboard/usuarios'

/** El backend responde 400 con este mensaje cuando la contraseña actual no coincide. */
const WRONG_CURRENT_PASSWORD = 'current password does not match'

function SectionCard({ icon: Icon, title, description, children }) {
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

function PageHeader({ userId, user }) {
  return (
    <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Container size="md" py="xl">
        <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
          <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
            Usuarios
          </Anchor>
          <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
            Usuario #{userId}
          </Text>
        </Breadcrumbs>
        <Title order={1} size="h2" mb={4}>
          {user ? `Editar a ${user.name}` : 'Editar usuario'}
        </Title>
        <Text c="dimmed">
          El rol y la inmobiliaria no se pueden cambiar. La contraseña se cambia aparte y pide la
          actual.
        </Text>
      </Container>
    </Box>
  )
}

/** Datos de la cuenta: nombre, email, teléfono, CUIT y matrícula. */
function AccountCard({ user, onSaved }) {
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
      const saved = await updateUser(user.id, toUserUpdateRequest(values), { signal: controller.signal })
      forgetCached('users', user.id)
      form.resetDirty()
      setStatus({ state: 'saved' })
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
function PasswordCard({ user }) {
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { currentPassword: '', password: '', confirmPassword: '' },
    validate: {
      currentPassword: (value) => (value ? null : 'Indique la contraseña actual.'),
      password: (value, values) => {
        const error = userValidation.password(value)
        if (error) return error
        return value === values.currentPassword ? 'La nueva tiene que ser distinta de la actual.' : null
      },
      confirmPassword: userValidation.confirmPassword,
    },
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async ({ currentPassword, password }) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'saving' })

    try {
      await updateUserPassword(user.id, { currentPassword, password }, { signal: controller.signal })
      form.reset()
      setStatus({ state: 'saved' })
    } catch (error) {
      if (controller.signal.aborted) return
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

/** `/usuarios/:id/editar`. */
export default function UserEdit() {
  const { id } = useParams()
  const [result, setResult] = useState(null) // { user } | { error }

  useEffect(() => {
    const controller = new AbortController()
    findUser(id, { signal: controller.signal })
      .then((user) => setResult({ user }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setResult({
          error:
            error instanceof ApiError && error.status === 404
              ? `No existe un usuario activo con el identificador #${id}. Si está dado de baja, restáurelo desde el listado.`
              : error.message,
        })
      })
    return () => controller.abort()
  }, [id])

  const user = result?.user
  const agency = useLookup('agencies', [user?.agencyId], findAgency)[user?.agencyId]

  return (
    <>
      <PageHeader userId={id} user={user} />
      <Container size="md" py="xl">
        {!result && <Skeleton height={420} radius="lg" />}

        {result?.error && (
          <Alert color="red" icon={<IconAlertTriangle />} title="No se puede editar el usuario">
            {result.error}{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Volver al listado
            </Anchor>
          </Alert>
        )}

        {user && (
          <Stack gap="xl">
            <Group gap="sm">
              <Badge variant="light" color={USER_ROL_COLOR[user.rol]}>
                {USER_ROL_LABEL[user.rol] ?? user.rol}
              </Badge>
              <Text size="sm" c="dimmed">
                {user.agencyId != null
                  ? `Inmobiliaria: ${agency?.publicName ?? `#${user.agencyId}`}`
                  : 'Sin inmobiliaria (registro público)'}
              </Text>
            </Group>

            <AccountCard key={user.id} user={user} onSaved={(saved) => setResult({ user: saved })} />
            <PasswordCard user={user} />

            <Group>
              <Button component={Link} to={LIST_PATH} variant="subtle" color="gray">
                Volver al listado
              </Button>
            </Group>
          </Stack>
        )}
      </Container>
    </>
  )
}
