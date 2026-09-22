import { Box, Button, Card, Container, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { IconArrowRight, IconTool } from '@tabler/icons-react'

/** Pantalla para las secciones del menú que todavía no están disponibles. */
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
