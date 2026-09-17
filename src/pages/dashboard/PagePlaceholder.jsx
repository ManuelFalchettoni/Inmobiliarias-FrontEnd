import { Box, Button, Card, Container, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { IconArrowRight, IconTool } from '@tabler/icons-react'

/**
 * Pantalla para las secciones del menú que todavía no tienen implementación.
 *
 * Existe para que ningún enlace de la navegación quede roto: antes todas estas
 * rutas caían en el `*` global y redirigían al login.
 */
export default function PagePlaceholder({ icon: Icon = IconTool, title, description, action }) {
  return (
    <Container size="xl" py="xl">
      <Group gap="sm" mb="xl" align="flex-start" wrap="nowrap">
        <ThemeIcon variant="light" size={44} radius="md">
          <Icon size={24} />
        </ThemeIcon>
        <Box>
          <Title order={1} size="h2">
            {title}
          </Title>
          <Text c="dimmed" maw={760}>
            {description}
          </Text>
        </Box>
      </Group>

      <Card withBorder radius="lg" padding="xl" shadow="xs">
        <Stack align="center" gap="xs" py="xl">
          <ThemeIcon variant="light" color="gray" size={56} radius="xl">
            <IconTool size={28} />
          </ThemeIcon>
          <Text fw={600}>Sección en construcción</Text>
          <Text size="sm" c="dimmed" ta="center" maw={460}>
            Todavía no está conectada al backend. Mientras tanto puede continuar con las secciones
            ya disponibles.
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
