import { Link, useLocation } from 'react-router-dom'
import { Alert, Anchor, Button, Checkbox, Group, PasswordInput, Text, TextInput } from '@mantine/core'
import { IconCircleCheck } from '@tabler/icons-react'
import AuthLayout from '../../layouts/AuthLayout.jsx'

export default function Login() {
  // Lo deja el registro al terminar: `{ name, email }` de la cuenta recién creada.
  const registered = useLocation().state?.registered

  return (
    <AuthLayout title="Bienvenido a Inmobiliarias">
      {registered && (
        <Alert color="teal" icon={<IconCircleCheck />} title="Cuenta creada" mb="md">
          {registered.name}, tu cuenta quedó registrada con {registered.email}.
        </Alert>
      )}

      <form onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label="Email"
          placeholder="hola@inmobiliaria.com"
          defaultValue={registered?.email}
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
