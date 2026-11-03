import { Badge, Button, Drawer, Group, Pill, Stack, Text } from '@mantine/core'
import { IconAdjustmentsHorizontal, IconFilterOff } from '@tabler/icons-react'

/**
 * Las piezas que comparten los listados con filtros en un panel lateral
 * (propiedades, contratos, personas): el botón que lo abre, el panel y la fila
 * de chips con lo que está aplicado.
 */

/** El botón "Filtros", con cuántos hay aplicados. */
export function FilterButton({ count, onClick }) {
  return (
    <Button
      variant={count > 0 ? 'light' : 'default'}
      leftSection={<IconAdjustmentsHorizontal size={16} />}
      rightSection={
        count > 0 && (
          <Badge size="sm" circle>
            {count}
          </Badge>
        )
      }
      onClick={onClick}
    >
      Filtros
    </Button>
  )
}

/**
 * La fila de filtros aplicados. Cada chip se quita con su ×; uno con un valor
 * que no se puede mandar (un "desde" mayor que el "hasta") se marca en rojo.
 */
export function ActiveFilters({ chips, errors = {}, onRemove, onClear }) {
  if (chips.length === 0) return null

  return (
    <Group gap="xs" mb="lg">
      {chips.map((chip) => {
        const conError = chip.names.some((name) => errors[name])
        return (
          <Pill
            key={chip.key}
            size="md"
            withRemoveButton
            onRemove={() => onRemove(chip.names)}
            removeButtonProps={{ 'aria-label': `Quitar ${chip.label}` }}
            title={conError ? chip.names.map((name) => errors[name]).find(Boolean) : undefined}
            bg={conError ? 'var(--mantine-color-danger-light)' : undefined}
            c={conError ? 'danger' : undefined}
          >
            {chip.label}
          </Pill>
        )
      })}
      <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconFilterOff size={14} />} onClick={onClear}>
        Limpiar todo
      </Button>
    </Group>
  )
}

/** Un bloque del panel con su título. */
export function FilterSection({ title, children }) {
  return (
    <Stack gap="sm">
      <Text fw={600}>{title}</Text>
      {children}
    </Stack>
  )
}

/** Un par desde/hasta en una sola fila, con una etiqueta para los dos. */
export function RangeRow({ label, from, to }) {
  return (
    <div>
      <Text size="sm" fw={500} mb={4}>
        {label}
      </Text>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {from}
        <Text c="dimmed" mt={6}>
          –
        </Text>
        {to}
      </Group>
    </div>
  )
}

/**
 * Panel lateral con los filtros. Se aplican mientras se escribe, así que el
 * botón de abajo solo cierra el panel y dice cuántos resultados quedan.
 * `noun` es el nombre de lo que se lista: ['propiedad', 'propiedades'].
 */
export function FilterPanel({ opened, onClose, total, noun: [singular, plural], hayFiltros, onClear, children }) {
  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="md" title={<Text fw={700} size="lg">Filtros</Text>}>
      <Stack gap="lg" pb="md">
        {children}
      </Stack>

      {/* Fijo abajo del panel, por encima de los campos al hacer scroll. */}
      <Group
        justify="space-between"
        pos="sticky"
        bottom={0}
        py="md"
        bg="var(--mantine-color-body)"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Button variant="subtle" color="gray" onClick={onClear} disabled={!hayFiltros}>
          Limpiar
        </Button>
        <Button onClick={onClose}>{total == null ? `Ver ${plural}` : `Ver ${total} ${total === 1 ? singular : plural}`}</Button>
      </Group>
    </Drawer>
  )
}
