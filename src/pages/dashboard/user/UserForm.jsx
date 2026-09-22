import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  PasswordInput,
  Select,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconAt, IconChevronRight, IconCircleCheck } from '@tabler/icons-react'

import { normalizePhone } from '../../../services/agencies.js'
import {
  USER_LIMITS,
  USER_ROL_LABEL,
  USER_ROL_OPTIONS,
  createUser,
  toUserRequest,
} from '../../../services/users.js'
import { describeUserError, userDefaultValues, userValidation } from '../../auth/user-form.js'

/** Desde el panel no hay términos que aceptar: los acepta quien se registra. */
const withoutTerms = (object) =>
  Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'acceptTerms'))

const validation = withoutTerms(userValidation)
const defaultValues = withoutTerms(userDefaultValues)

export default function UserForm() {
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: defaultValues,
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
      const user = await createUser(toUserRequest(values), { signal: controller.signal })
      form.reset()
      setStatus({ state: 'created', user })
    } catch (error) {
      if (controller.signal.aborted) return

      const { message, fieldErrors } = describeUserError(error)
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
      <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="md" py="xl">
          <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
            <Anchor component={Link} to="/dashboard/usuarios" size="xs" c="dimmed" tt="uppercase" fw={600}>
              Usuarios
            </Anchor>
            <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
              Nuevo usuario
            </Text>
          </Breadcrumbs>
          <Title order={1} size="h2" mb={4}>
            Alta de usuario
          </Title>
          <Text c="dimmed">
            Cree una cuenta con su rol. La contraseña se guarda hasheada y el usuario puede
            cambiarla después.
          </Text>
        </Container>
      </Box>

      <Container size="md" py="xl">
        {status.state === 'created' && (
          <Alert
            color="teal"
            icon={<IconCircleCheck />}
            title="Usuario creado"
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            <b>{status.user?.name}</b> ({status.user?.email}) quedó registrado
            {status.user?.id != null && ` con el identificador #${status.user.id}`} y rol{' '}
            <b>{USER_ROL_LABEL[status.user?.rol] ?? status.user?.rol}</b>.
          </Alert>
        )}

        {status.state === 'error' && (
          <Alert
            color="red"
            icon={<IconAlertTriangle />}
            title="No se pudo crear el usuario"
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            {status.message}
          </Alert>
        )}

        <Card withBorder radius="lg" padding="xl" shadow="xs">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Nombre"
              placeholder="María Pérez"
              description={`Entre ${USER_LIMITS.name.min} y ${USER_LIMITS.name.max} caracteres`}
              withAsterisk
              maxLength={USER_LIMITS.name.max}
              key={form.key('name')}
              {...form.getInputProps('name')}
            />
            <Select
              label="Rol"
              description="Define qué puede hacer la cuenta en la plataforma"
              data={USER_ROL_OPTIONS}
              allowDeselect={false}
              withAsterisk
              key={form.key('rol')}
              {...form.getInputProps('rol')}
            />
            <TextInput
              label="Email"
              placeholder="maria@inmobiliaria.com"
              type="email"
              leftSection={<IconAt size={16} />}
              withAsterisk
              maxLength={USER_LIMITS.email.max}
              key={form.key('email')}
              {...form.getInputProps('email')}
            />
            <TextInput
              label="Teléfono"
              placeholder="+5491112345678"
              description="Se guarda compacto, hasta 15 caracteres"
              type="tel"
              withAsterisk
              key={form.key('phoneNumber')}
              {...form.getInputProps('phoneNumber')}
              onBlur={(event) => {
                form.setFieldValue('phoneNumber', normalizePhone(event.currentTarget.value))
                form.validateField('phoneNumber')
              }}
            />
            <PasswordInput
              label="Contraseña"
              placeholder={`Entre ${USER_LIMITS.password.min} y ${USER_LIMITS.password.max} caracteres`}
              autoComplete="new-password"
              withAsterisk
              maxLength={USER_LIMITS.password.max}
              key={form.key('password')}
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label="Repetir contraseña"
              autoComplete="new-password"
              withAsterisk
              maxLength={USER_LIMITS.password.max}
              key={form.key('confirmPassword')}
              {...form.getInputProps('confirmPassword')}
            />
          </SimpleGrid>

          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" color="gray" onClick={() => form.reset()} disabled={isSubmitting}>
              Limpiar
            </Button>
            <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={isSubmitting}>
              Crear usuario
            </Button>
          </Group>
        </Card>
      </Container>
    </form>
  )
}
