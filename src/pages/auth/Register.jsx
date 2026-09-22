import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Anchor, Button, Checkbox, PasswordInput, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle } from '@tabler/icons-react'

import AuthLayout from '../../layouts/AuthLayout.jsx'
import { normalizePhone } from '../../services/agencies.js'
import { PUBLIC_SIGNUP_ROL, USER_LIMITS, createUser, toUserRequest } from '../../services/users.js'
import { describeUserError, userDefaultValues, userValidation } from './user-form.js'

export default function Register() {
  const navigate = useNavigate()
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: userDefaultValues,
    validateInputOnBlur: true,
    validate: userValidation,
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'submitting' })

    try {
      // El rol no sale del formulario: desde el registro público solo se crean USER.
      const user = await createUser(toUserRequest({ ...values, rol: PUBLIC_SIGNUP_ROL }), {
        signal: controller.signal,
      })
      navigate('/login', { state: { registered: { name: user.name, email: user.email } } })
    } catch (error) {
      if (controller.signal.aborted) return

      const { message, fieldErrors } = describeUserError(error)
      const fields = Object.keys(fieldErrors)
      if (fields.length > 0) {
        form.setErrors(fieldErrors)
        form.getInputNode(fields[0])?.focus()
      }
      setStatus({ state: 'error', message })
    }
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)
  const isSubmitting = status.state === 'submitting'

  return (
    <AuthLayout title="Creá tu cuenta">
      {status.state === 'error' && (
        <Alert
          color="red"
          icon={<IconAlertTriangle />}
          title="No se pudo crear la cuenta"
          mb="md"
          withCloseButton
          onClose={() => setStatus({ state: 'idle' })}
        >
          {status.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <TextInput
          label="Nombre"
          placeholder="María Pérez"
          description={`Entre ${USER_LIMITS.name.min} y ${USER_LIMITS.name.max} caracteres`}
          autoComplete="name"
          maxLength={USER_LIMITS.name.max}
          size="md"
          radius="md"
          withAsterisk
          key={form.key('name')}
          {...form.getInputProps('name')}
        />
        <TextInput
          label="Email"
          placeholder="hola@inmobiliaria.com"
          type="email"
          autoComplete="email"
          maxLength={USER_LIMITS.email.max}
          mt="md"
          size="md"
          radius="md"
          withAsterisk
          key={form.key('email')}
          {...form.getInputProps('email')}
        />
        <TextInput
          label="Teléfono"
          placeholder="+5491112345678"
          type="tel"
          autoComplete="tel"
          mt="md"
          size="md"
          radius="md"
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
          maxLength={USER_LIMITS.password.max}
          mt="md"
          size="md"
          radius="md"
          withAsterisk
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
        <PasswordInput
          label="Repetir contraseña"
          placeholder="Repetí tu contraseña"
          autoComplete="new-password"
          maxLength={USER_LIMITS.password.max}
          mt="md"
          size="md"
          radius="md"
          withAsterisk
          key={form.key('confirmPassword')}
          {...form.getInputProps('confirmPassword')}
        />

        <Checkbox
          label="Acepto los términos y condiciones"
          mt="xl"
          key={form.key('acceptTerms')}
          {...form.getInputProps('acceptTerms', { type: 'checkbox' })}
        />

        <Button type="submit" fullWidth mt="xl" size="md" radius="md" loading={isSubmitting}>
          Crear cuenta
        </Button>
      </form>

      <Text ta="center" mt="md">
        ¿Ya tenés una cuenta?{' '}
        <Anchor component={Link} to="/login" fw={500}>
          Iniciá sesión
        </Anchor>
      </Text>
    </AuthLayout>
  )
}
