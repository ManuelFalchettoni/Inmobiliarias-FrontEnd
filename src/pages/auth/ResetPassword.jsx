import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Anchor, Button, PasswordInput, Text } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconLinkOff } from '@tabler/icons-react'

import AuthLayout from '../../layouts/AuthLayout.jsx'
import { ApiError } from '../../services/api.js'
import { resetPassword } from '../../services/auth.js'
import { USER_LIMITS } from '../../services/users.js'
import { userValidation } from './user-form.js'

/**
 * `/restablecer-contrasena?token=...`: adonde lleva el link del mail de
 * "¿Olvidaste tu contraseña?". Pide la contraseña nueva y la manda con el token
 * (`POST /api/auth/password/reset`). Si sale bien, vuelve al login.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  // 'idle', 'submitting', 'error' (se puede reintentar) o 'invalid' (el link no sirve más).
  const [status, setStatus] = useState({ state: token ? 'idle' : 'invalid' })
  const abortRef = useRef(null)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { password: '', confirmPassword: '' },
    validateInputOnBlur: true,
    validate: {
      password: userValidation.password,
      confirmPassword: userValidation.confirmPassword,
    },
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async ({ password }) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'submitting' })

    try {
      await resetPassword({ token, password }, { signal: controller.signal })
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch (error) {
      if (controller.signal.aborted) return
      // La contraseña ya se validó acá: un 400 es el link (inexistente, usado o vencido).
      if (error instanceof ApiError && error.status === 400) {
        setStatus({ state: 'invalid' })
        return
      }
      setStatus({
        state: 'error',
        message: error.message ?? 'Ocurrió un error inesperado al cambiar la contraseña.',
      })
    }
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)

  if (status.state === 'invalid') {
    return (
      <AuthLayout title="El link no sirve más">
        <Alert color="yellow" icon={<IconLinkOff />} title="Link vencido o ya usado" mb="md">
          Los links para restablecer la contraseña duran una hora y sirven una sola vez. Pedí uno
          nuevo desde el login con «¿Olvidaste tu contraseña?».
        </Alert>
        <Button component={Link} to="/login" state={{ forgot: true }} fullWidth size="md" radius="md">
          Pedir otro link
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Elegí una contraseña nueva">
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
        <PasswordInput
          label="Contraseña nueva"
          placeholder={`Entre ${USER_LIMITS.password.min} y ${USER_LIMITS.password.max} caracteres`}
          autoComplete="new-password"
          maxLength={USER_LIMITS.password.max}
          size="md"
          radius="md"
          withAsterisk
          data-autofocus
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
        <PasswordInput
          label="Repetir contraseña"
          placeholder="Repetí la contraseña nueva"
          autoComplete="new-password"
          maxLength={USER_LIMITS.password.max}
          mt="md"
          size="md"
          radius="md"
          withAsterisk
          key={form.key('confirmPassword')}
          {...form.getInputProps('confirmPassword')}
        />

        <Button type="submit" fullWidth mt="xl" size="md" radius="md" loading={status.state === 'submitting'}>
          Cambiar contraseña
        </Button>
      </form>

      <Text ta="center" mt="md">
        <Anchor component={Link} to="/login" fw={500}>
          Volver al login
        </Anchor>
      </Text>
    </AuthLayout>
  )
}
