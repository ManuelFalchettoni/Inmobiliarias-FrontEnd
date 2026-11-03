import { Button, Divider, Drawer, Group, MultiSelect, Pill, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconFilterOff } from '@tabler/icons-react'

import FilterInput from '../../../components/FilterInput.jsx'
import {
  CURRENCY_OPTIONS,
  OPERATION_TYPE_OPTIONS,
  PROPERTY_CONDITION_OPTIONS,
  PROPERTY_OCCUPANCY_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from '../../../services/properties.js'

/**
 * La fila de filtros aplicados. Cada chip se quita con su ×; uno con un valor
 * que no se puede mandar (un "desde" mayor que el "hasta") se marca en rojo.
 */
export function ActiveFilters({ chips, errors, onRemove, onClear }) {
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
function Section({ title, children }) {
  return (
    <Stack gap="sm">
      <Text fw={600}>{title}</Text>
      {children}
    </Stack>
  )
}

/** Un par desde/hasta en una sola fila, con una etiqueta para los dos. */
function RangeField({ label, from, to, suffix }) {
  return (
    <div>
      <Text size="sm" fw={500} mb={4}>
        {label}
      </Text>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <FilterInput number flex={1} placeholder="Desde" aria-label={`${label} desde`} suffix={suffix} {...from} />
        <Text c="dimmed" mt={6}>
          –
        </Text>
        <FilterInput number flex={1} placeholder="Hasta" aria-label={`${label} hasta`} suffix={suffix} {...to} />
      </Group>
    </div>
  )
}

/**
 * Panel lateral con todos los filtros, agrupados. Se aplican mientras se
 * escribe (igual que antes), así que el botón de abajo solo cierra el panel y
 * dice cuántas propiedades quedan.
 */
export function FilterDrawer({ opened, onClose, fields, total, hayFiltros, onClear }) {
  const { textFilter, intFilter, priceFilter, selectFilter, multiFilter, filterValue } = fields

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="md" title={<Text fw={700} size="lg">Filtros</Text>}>
      <Stack gap="lg" pb="md">
        <Section title="Operación y precio">
          <SimpleGrid cols={2}>
            <Select label="Operación" placeholder="Venta o alquiler" data={OPERATION_TYPE_OPTIONS} {...selectFilter('operationType')} />
            {/* El precio que se filtra es el de la operación elegida. */}
            <Select label="Moneda" placeholder="Cualquiera" data={CURRENCY_OPTIONS} {...selectFilter('currency')} />
          </SimpleGrid>
          <RangeField label="Precio" from={priceFilter('minPrice')} to={priceFilter('maxPrice')} />
        </Section>

        <Divider />

        {/* Los de texto son parciales y sin acentos: "cord" encuentra "Córdoba". */}
        <Section title="Ubicación">
          <SimpleGrid cols={2}>
            <FilterInput label="Ciudad" placeholder="Cualquiera" {...textFilter('city')} />
            <FilterInput label="Partido" placeholder="Cualquiera" {...textFilter('county')} />
            <FilterInput label="Provincia" placeholder="Cualquiera" {...textFilter('province')} />
            <FilterInput label="Dirección" placeholder="Cualquiera" {...textFilter('address')} />
          </SimpleGrid>
        </Section>

        <Divider />

        <Section title="Características">
          <MultiSelect
            label="Tipo"
            placeholder={filterValue('type') ? undefined : 'Todos'}
            data={PROPERTY_TYPE_OPTIONS}
            {...multiFilter('type')}
          />
          <RangeField label="Ambientes" from={intFilter('minRooms')} to={intFilter('maxRooms')} />
          <RangeField label="Superficie" suffix=" m²" from={intFilter('minSize')} to={intFilter('maxSize')} />
          {/* Con piso, las propiedades sin piso cargado (casas, terrenos) quedan afuera. */}
          <RangeField label="Piso" from={intFilter('minFloor')} to={intFilter('maxFloor')} />
          <RangeField label="Año de construcción" from={intFilter('minYear')} to={intFilter('maxYear')} />
        </Section>

        <Divider />

        <Section title="Estado">
          <SimpleGrid cols={2}>
            <MultiSelect
              label="Condición"
              placeholder={filterValue('condition') ? undefined : 'Todas'}
              data={PROPERTY_CONDITION_OPTIONS}
              {...multiFilter('condition')}
            />
            <MultiSelect
              label="Ocupación"
              placeholder={filterValue('occupancy') ? undefined : 'Todas'}
              data={PROPERTY_OCCUPANCY_OPTIONS}
              {...multiFilter('occupancy')}
            />
          </SimpleGrid>
        </Section>
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
        <Button onClick={onClose}>
          {total == null ? 'Ver propiedades' : `Ver ${total} ${total === 1 ? 'propiedad' : 'propiedades'}`}
        </Button>
      </Group>
    </Drawer>
  )
}
