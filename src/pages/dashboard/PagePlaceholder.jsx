import { Box, Button, Card, Container, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { IconArrowRight, IconTool } from '@tabler/icons-react'

/**
 * Pantalla para las secciones del menú que todavía no están disponibles.
 * `icon: Icon = IconTool` renombra la prop con mayúscula (React exige que los
 * componentes empiecen con mayúscula para dibujarlos como `<Icon />`) y le da
 * un valor por defecto si no se pasa.
 */
export default function PagePlaceholder({ icon: Icon = IconTool, title, description, action }) {
  return (
    <Container size="xl" py="xl">
      <Box mb="xl">
        <Title order={1} size="h2">
          {title}
        </Title>
        <Text c="dimmed" maw={760}>
          {description}
        </Text>
      </Box>

      <Card variant="empty" radius="lg" padding="xl">
        <Stack align="center" gap="xs" py="xl">
          <ThemeIcon variant="light" color="gray" size={56} radius="xl">
            <Icon size={28} />
          </ThemeIcon>
          <Text fw={600}>Próximamente</Text>
          <Text size="sm" c="dimmed" ta="center" maw={460}>
            Estamos trabajando en esta sección.
          </Text>
          {action && (
            <Button
              component={Link}
              to={action.to}
              mt="md"
              variant="light"
              rightSection={<IconArrowRight size={16} />}
            >
              {action.label}
            </Button>
          )}
        </Stack>
      </Card>
    </Container>
  )
}
