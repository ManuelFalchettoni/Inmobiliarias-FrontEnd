import { Divider, Select, SimpleGrid, TextInput } from '@mantine/core'

import FilterInput from '../../../components/FilterInput.jsx'
import { FilterPanel, FilterSection as Section, RangeRow } from '../../../components/FilterPanel.jsx'
import { CONTRACT_STATUS_OPTIONS, CONTRACT_TYPE_OPTIONS } from '../../../services/contracts.js'
import { CURRENCY_OPTIONS } from '../../../services/properties.js'

/** Panel lateral con todos los filtros de contratos. Los rangos son inclusivos. */
export function ContractFilterPanel({ opened, onClose, fields, propertyOptions, total, hayFiltros, onClear }) {
  const { selectFilter, dateFilter, amountFilter } = fields

  return (
    <FilterPanel
      opened={opened}
      onClose={onClose}
      total={total}
      noun={['contrato', 'contratos']}
      hayFiltros={hayFiltros}
      onClear={onClear}
    >
      <Section title="Contrato">
        <Select
          label="Propiedad"
          placeholder={propertyOptions.state === 'loading' ? 'Cargando propiedades...' : 'Todas'}
          data={propertyOptions.options}
          searchable
          nothingFoundMessage="Sin coincidencias"
          {...selectFilter('propertyId')}
        />
        <SimpleGrid cols={2}>
          <Select label="Estado" placeholder="Todos" data={CONTRACT_STATUS_OPTIONS} {...selectFilter('status')} />
          <Select label="Tipo" placeholder="Todos" data={CONTRACT_TYPE_OPTIONS} {...selectFilter('type')} />
        </SimpleGrid>
      </Section>

      <Divider />

      <Section title="Monto">
        <Select label="Moneda" placeholder="Todas" data={CURRENCY_OPTIONS} {...selectFilter('currency')} />
        <RangeRow
          label="Monto"
          from={<FilterInput number flex={1} placeholder="Desde" aria-label="Monto desde" {...amountFilter('minAmount')} />}
          to={<FilterInput number flex={1} placeholder="Hasta" aria-label="Monto hasta" {...amountFilter('maxAmount')} />}
        />
      </Section>

      <Divider />

      {/* Con "Vence" desde/hasta salen los que terminan en un período. */}
      <Section title="Fechas">
        <RangeRow
          label="Empieza"
          from={<TextInput flex={1} aria-label="Empieza desde" {...dateFilter('startFrom')} />}
          to={<TextInput flex={1} aria-label="Empieza hasta" {...dateFilter('startTo')} />}
        />
        <RangeRow
          label="Vence"
          from={<TextInput flex={1} aria-label="Vence desde" {...dateFilter('endFrom')} />}
          to={<TextInput flex={1} aria-label="Vence hasta" {...dateFilter('endTo')} />}
        />
      </Section>
    </FilterPanel>
  )
}
