import { Link } from 'react-router-dom'
import { Anchor, Button, Checkbox, Group, PasswordInput, Text, TextInput } from '@mantine/core'
import AuthLayout from '../../layouts/AuthLayout.jsx'

export default function Login() {
  return (
    <AuthLayout title="Bienvenido a Inmobiliarias">
      <form onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label="Email"
          placeholder="hola@inmobiliaria.com"
          size="md"
          radius="md"
        />
        <PasswordInput
          label="Contraseña"
          placeholder="Tu contraseña"
          mt="md"
          size="md"
          radius="md"
        />

        <Group justify="space-between" mt="xl">
          <Checkbox label="Mantener sesión iniciada" />
          <Anchor component="button" type="button" size="sm" c="dimmed">
            ¿Olvidaste tu contraseña?
          </Anchor>
        </Group>

        <Button type="submit" fullWidth mt="xl" size="md" radius="md">
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
