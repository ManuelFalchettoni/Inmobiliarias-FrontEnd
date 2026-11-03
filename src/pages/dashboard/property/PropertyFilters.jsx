import { Divider, MultiSelect, Select, SimpleGrid } from '@mantine/core'

import FilterInput from '../../../components/FilterInput.jsx'
import { FilterPanel, FilterSection as Section, RangeRow } from '../../../components/FilterPanel.jsx'
import {
  CURRENCY_OPTIONS,
  OPERATION_TYPE_OPTIONS,
  PROPERTY_CONDITION_OPTIONS,
  PROPERTY_OCCUPANCY_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from '../../../services/properties.js'

/** Un par desde/hasta de números. */
function RangeField({ label, from, to, suffix }) {
  return (
    <RangeRow
      label={label}
      from={<FilterInput number flex={1} placeholder="Desde" aria-label={`${label} desde`} suffix={suffix} {...from} />}
      to={<FilterInput number flex={1} placeholder="Hasta" aria-label={`${label} hasta`} suffix={suffix} {...to} />}
    />
  )
}

/**
 * Panel lateral con todos los filtros de propiedades, agrupados.
 */
export function FilterDrawer({ opened, onClose, fields, total, hayFiltros, onClear }) {
  const { textFilter, intFilter, priceFilter, selectFilter, multiFilter, filterValue } = fields

  return (
    <FilterPanel
      opened={opened}
      onClose={onClose}
      total={total}
      noun={['propiedad', 'propiedades']}
      hayFiltros={hayFiltros}
      onClear={onClear}
    >
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
    </FilterPanel>
  )
}
