import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Anchor, Button, Checkbox, PasswordInput, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle } from '@tabler/icons-react'

import AuthLayout from '../../layouts/AuthLayout.jsx'
import { normalizePhone } from '../../services/agencies.js'
import { USER_LIMITS, registerUser, toRegisterRequest } from '../../services/users.js'
import { describeUserError, userDefaultValues, userValidation } from './user-form.js'

/** Registro público (`/registro`): crea una cuenta USER sin inmobiliaria. */
export default function Register() {
  // useNavigate devuelve una función para cambiar de pantalla desde el código.
  const navigate = useNavigate()
  // Estado del envío: 'idle' (quieto), 'submitting' (enviando) o 'error'.
  const [status, setStatus] = useState({ state: 'idle' })
  // Guarda el AbortController del pedido en curso. Es un ref y no un estado
  // porque cambiarlo no tiene que redibujar la pantalla.
  const abortRef = useRef(null)

  // Mantine Form. `uncontrolled`: escribir no redibuja la página; el formulario
  // lee los inputs cuando los necesita. `validateInputOnBlur`: valida cada
  // campo al salir de él, no en cada tecla.
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: userDefaultValues,
    validateInputOnBlur: true,
    validate: userValidation,
  })

  // Efecto sin código al montar, solo con limpieza: al salir de la pantalla se
  // cancela el registro si todavía estaba en camino.
  useEffect(() => () => abortRef.current?.abort(), [])

  // Solo se llama si todas las reglas de validación pasaron.
  const handleSubmit = async (values) => {
    // Si se envía dos veces seguidas, se cancela el pedido anterior.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'submitting' })

    try {
      const user = await registerUser(toRegisterRequest(values), { signal: controller.signal })
      // `state` viaja con la navegación sin aparecer en la dirección: el login
      // lo lee para mostrar "Cuenta creada" y dejar el email escrito.
      navigate('/login', { state: { registered: { name: user.name, email: user.email } } })
    } catch (error) {
      // Un pedido cancelado no es un error para mostrar.
      if (controller.signal.aborted) return

      // Los errores del backend se ponen debajo del campo que los causó y se
      // lleva el cursor al primero.
      const { message, fieldErrors } = describeUserError(error)
      const fields = Object.keys(fieldErrors)
      if (fields.length > 0) {
        form.setErrors(fieldErrors)
        form.getInputNode(fields[0])?.focus()
      }
      setStatus({ state: 'error', message })
    }
  }

  // `form.onSubmit` valida y, si está todo bien, llama a handleSubmit. Se arma
  // dentro del evento (y no al dibujar) para no leer el formulario en el render.
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

      {/* `noValidate` apaga la validación propia del navegador (los globitos de
          HTML5): la valida Mantine con las mismas reglas que el backend. */}
      <form onSubmit={onSubmit} noValidate>
        {/* `key` y `getInputProps` conectan el input con el formulario: valor,
            cambios y mensaje de error. El `...` pasa ese objeto como props. */}
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
          // Al salir del campo se compacta el teléfono ("+54 341 555" ->
          // "+54341555") y se vuelve a validar con el valor ya limpio.
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
