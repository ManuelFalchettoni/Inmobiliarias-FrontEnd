import { Alert, Box, Button, Card, Code, Container, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { IconArrowRight, IconPlugConnectedX, IconTool } from '@tabler/icons-react'

/**
 * Pantalla para las secciones del menú que todavía no tienen implementación.
 *
 * Distingue dos casos: la sección que el backend ya puede alimentar (muestra el
 * endpoint que le toca) y la que no existe todavía del lado del servidor
 * (explica qué falta). Antes todas estas rutas caían en el `*` global y
 * redirigían al login.
 */
export default function PagePlaceholder({
  icon: Icon = IconTool,
  title,
  description,
  endpoint,
  blockedBy,
  action,
}) {
  return (
    <Container size="xl" py="xl">
      <Group gap="sm" mb="xl" align="flex-start" wrap="nowrap">
        <ThemeIcon variant="light" size={44} radius="md" color={blockedBy ? 'gray' : undefined}>
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

      {blockedBy ? (
        <Alert
          color="gray"
          icon={<IconPlugConnectedX />}
          title="El backend todavía no expone estos datos"
          maw={760}
        >
          {blockedBy}
        </Alert>
      ) : (
        <Card withBorder radius="lg" padding="xl" shadow="xs">
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconTool size={28} />
            </ThemeIcon>
            <Text fw={600}>Sección pendiente de implementar</Text>
            <Text size="sm" c="dimmed" ta="center" maw={460}>
              El endpoint ya existe en el backend; falta la pantalla que lo consuma.
            </Text>
            {endpoint && <Code mt={4}>{endpoint}</Code>}
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
      )}
    </Container>
  )
}
