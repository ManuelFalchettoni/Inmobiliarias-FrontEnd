import { Avatar, Badge, Box, Card, Group, Paper, Progress, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconEye, IconShieldCheck } from '@tabler/icons-react'

import { AGENCY_STATUS_COLOR, AGENCY_STATUS_SHORT_LABEL, formatCuit, normalizePhone, normalizeWebUrl } from '../../../services/agencies.js'
import { getProgress } from './agency-form.js'

function getInitials(name) {
  const initials = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
  return initials || 'AG'
}

function SummaryRow({ label, children, mono = false }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md" align="flex-start">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" ff={mono ? 'monospace' : undefined} style={{ minWidth: 0 }} truncate>
        {children || '—'}
      </Text>
    </Group>
  )
}

/**
 * Vista previa en vivo del alta.
 *
 * El formulario corre en modo `uncontrolled`, así que escribir en un campo no
 * re-renderiza la página. Este componente se suscribe campo por campo con
 * `form.useWatchValue` (un `useSyncExternalStore` por ruta), de modo que el
 * re-render por tecleo queda acotado a esta tarjeta.
 */
export default function AgencySummary({ form }) {
  const cuit = form.useWatchValue('cuit')
  const companyName = form.useWatchValue('companyName')
  const publicName = form.useWatchValue('publicName')
  const email = form.useWatchValue('email')
  const phoneNumber = form.useWatchValue('phoneNumber')
  const address = form.useWatchValue('address')
  const webURL = form.useWatchValue('webURL')
  const socials = form.useWatchValue('socials')
  const password = form.useWatchValue('password')
  const confirmPassword = form.useWatchValue('confirmPassword')
  const status = form.useWatchValue('status')
  const acceptTerms = form.useWatchValue('acceptTerms')

  const values = {
    cuit,
    companyName,
    publicName,
    email,
    phoneNumber,
    address,
    webURL,
    socials,
    password,
    confirmPassword,
    status,
    acceptTerms,
  }

  const progress = getProgress(values)
  const isReady = progress === 100
  const statusLabel = AGENCY_STATUS_SHORT_LABEL[status] ?? status

  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" pos="sticky" top="calc(var(--app-shell-header-height, 72px) + var(--mantine-spacing-md))">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconEye size={20} color="var(--mantine-primary-color-filled)" />
          <Text fw={600}>Vista previa</Text>
        </Group>
        <Badge variant="light" size="sm">
          En vivo
        </Badge>
      </Group>

      <Paper
        withBorder
        radius="md"
        p="sm"
        mb="md"
        style={{ borderTop: '3px solid var(--mantine-primary-color-filled)' }}
      >
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Avatar color="dark" variant="filled" radius="md">
              {getInitials(publicName || companyName)}
            </Avatar>
            <Box miw={0}>
              <Text fw={600} truncate>
                {publicName || 'Nombre comercial'}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {companyName || 'Razón social'}
              </Text>
            </Box>
          </Group>
          <Badge color={AGENCY_STATUS_COLOR[status]} variant="light" style={{ flexShrink: 0 }}>
            {statusLabel}
          </Badge>
        </Group>
      </Paper>

      <Stack gap="xs" mb="lg">
        <SummaryRow label="CUIT" mono>
          {cuit && formatCuit(cuit)}
        </SummaryRow>
        <SummaryRow label="Email">{email.trim().toLowerCase()}</SummaryRow>
        <SummaryRow label="Teléfono" mono>
          {phoneNumber && normalizePhone(phoneNumber)}
        </SummaryRow>
        <SummaryRow label="Dirección">{address.trim()}</SummaryRow>
        <SummaryRow label="Web">{webURL && normalizeWebUrl(webURL)}</SummaryRow>
        <SummaryRow label="Redes">{socials.trim()}</SummaryRow>
      </Stack>

      <Group justify="space-between" mb={6}>
        <Text size="sm" fw={600}>
          Progreso del alta
        </Text>
        <Text size="sm" fw={600} c={isReady ? 'teal' : 'var(--mantine-primary-color-filled)'}>
          {progress}%
        </Text>
      </Group>
      <Progress value={progress} radius="xl" size="md" color={isReady ? 'teal' : undefined} />

      {isReady && (
        <Group gap="xs" mt="md" wrap="nowrap">
          <ThemeIcon size={28} radius="md" variant="light" color="teal">
            <IconShieldCheck size={16} />
          </ThemeIcon>
          <Text size="xs" c="dimmed">
            Todos los datos obligatorios están completos. Ya puede crear la agencia.
          </Text>
        </Group>
      )}
    </Card>
  )
}
