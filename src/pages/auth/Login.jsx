import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Anchor, Button, Checkbox, Group, PasswordInput, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'

import AuthLayout from '../../layouts/AuthLayout.jsx'
import { useAuth } from '../../context/auth-context.js'
import { ApiError } from '../../services/api.js'
import { USER_LIMITS } from '../../services/users.js'
import { userValidation } from './user-form.js'

/** A dónde va después de entrar si no venía de otra pantalla del panel. */
const AFTER_LOGIN = '/dashboard'

/**
 * Pantalla de login: `POST /api/auth/login`. Si sale bien, el usuario queda
 * guardado en la sesión (AuthContext) y se entra al panel.
 */
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  // Lo deja el registro al terminar: `{ name, email }` de la cuenta recién creada.
  const registered = location.state?.registered
  // Lo deja una pantalla del panel que pidió iniciar sesión (Configuración).
  const from = location.state?.from

  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: registered?.email ?? '', password: '', remember: false },
    validateInputOnBlur: true,
    validate: {
      email: userValidation.email,
      password: (value) => (value ? null : 'Indique la contraseña.'),
    },
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'submitting' })

    try {
      await login(values, { signal: controller.signal })
      navigate(from ?? AFTER_LOGIN, { replace: true })
    } catch (error) {
      if (controller.signal.aborted) return
      // 401: email inexistente, usuario dado de baja o contraseña incorrecta.
      // El backend no dice cuál a propósito, y acá tampoco.
      // 400: la contraseña no cumple 8 a 20 caracteres; tampoco puede ser correcta.
      const badCredentials = error instanceof ApiError && (error.status === 401 || error.status === 400)
      setStatus({
        state: 'error',
        message: badCredentials
          ? 'El email o la contraseña no son correctos.'
          : error.message ?? 'Ocurrió un error inesperado al iniciar sesión.',
      })
    }
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)

  return (
    <AuthLayout title="Bienvenido a Inmobiliarias">
      {registered && status.state !== 'error' && (
        <Alert color="teal" icon={<IconCircleCheck />} title="Cuenta creada" mb="md">
          {registered.name}, tu cuenta quedó registrada con {registered.email}.
        </Alert>
      )}

      {status.state === 'error' && (
        <Alert
          color="red"
          icon={<IconAlertTriangle />}
          title="No se pudo iniciar sesión"
          mb="md"
          withCloseButton
          onClose={() => setStatus({ state: 'idle' })}
        >
          {status.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <TextInput
          label="Email"
          type="email"
          placeholder="hola@inmobiliaria.com"
          autoComplete="email"
          size="md"
          radius="md"
          maxLength={USER_LIMITS.email.max}
          key={form.key('email')}
          {...form.getInputProps('email')}
        />
        <PasswordInput
          label="Contraseña"
          placeholder="Tu contraseña"
          autoComplete="current-password"
          mt="md"
          size="md"
          radius="md"
          maxLength={USER_LIMITS.password.max}
          key={form.key('password')}
          {...form.getInputProps('password')}
        />

        <Group justify="space-between" mt="xl">
          <Checkbox
            label="Mantener sesión iniciada"
            key={form.key('remember')}
            {...form.getInputProps('remember', { type: 'checkbox' })}
          />
          <Anchor component="button" type="button" size="sm" c="dimmed">
            ¿Olvidaste tu contraseña?
          </Anchor>
        </Group>

        <Button type="submit" fullWidth mt="xl" size="md" radius="md" loading={status.state === 'submitting'}>
          Iniciar sesión
        </Button>
      </form>

      <Text ta="center" mt="md">
        ¿No tenés una cuenta?{' '}
        <Anchor component={Link} to="/registro" fw={500}>
          Registrate
        </Anchor>
      </Text>
    </AuthLayout>
  )
}
