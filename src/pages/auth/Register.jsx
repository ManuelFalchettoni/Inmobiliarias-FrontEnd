import { Link } from 'react-router-dom'
import { Anchor, Button, Checkbox, PasswordInput, Text, TextInput } from '@mantine/core'
import AuthLayout from '../../layouts/AuthLayout.jsx'

export default function Register() {
  return (
    <AuthLayout title="Creá tu cuenta">
      <form onSubmit={(event) => event.preventDefault()}>
        <TextInput label="Nombre completo" placeholder="María Pérez" size="md" radius="md" />
        <TextInput
          label="Email"
          placeholder="hola@inmobiliaria.com"
          mt="md"
          size="md"
          radius="md"
        />
        <PasswordInput
          label="Contraseña"
          placeholder="Al menos 8 caracteres"
          mt="md"
          size="md"
          radius="md"
        />
        <PasswordInput
          label="Repetir contraseña"
          placeholder="Repetí tu contraseña"
          mt="md"
          size="md"
          radius="md"
        />

        <Checkbox label="Acepto los términos y condiciones" mt="xl" />

        <Button type="submit" fullWidth mt="xl" size="md" radius="md">
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
