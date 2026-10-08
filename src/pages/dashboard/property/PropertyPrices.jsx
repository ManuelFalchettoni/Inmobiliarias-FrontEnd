import { Group, NumberInput, Paper, Select, Stack, Switch, Text } from '@mantine/core'

import {
  CURRENCY_OPTIONS,
  OPERATION_TYPE_OPTIONS,
  PRICE_LIMITS,
} from '../../../services/properties.js'

/**
 * Una fila por operación. El formulario corre en modo `uncontrolled`: cada fila
 * se suscribe solo a su `enabled` para habilitar o apagar sus inputs.
 */
function PriceRow({ form, operationType, label, disabled }) {
  // Ruta del campo dentro del formulario: "prices.SALE" o "prices.RENT".
  const path = `prices.${operationType}`
  // useWatchValue suscribe este componente a un solo campo: al mover el switch
  // se redibuja esta fila, no todo el formulario.
  const enabled = form.useWatchValue(`${path}.enabled`)
  // Los inputs se apagan si la operación no se ofrece o si se está guardando.
  const inactive = disabled || !enabled

  return (
    <Paper withBorder radius="md" p="md" bg={enabled ? undefined : 'gray.0'}>
      <Group justify="space-between" align="flex-start" gap="md">
        <Switch
          label={label}
          description={enabled ? 'Se publica con este precio' : 'No se ofrece'}
          disabled={disabled}
          miw={180}
          key={form.key(`${path}.enabled`)}
          // `type: 'checkbox'`: el switch trabaja con `checked` (verdadero/falso)
          // en vez de `value` (texto).
          {...form.getInputProps(`${path}.enabled`, { type: 'checkbox' })}
        />
        <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 260 }}>
          <Select
            aria-label={`Moneda de ${label.toLowerCase()}`}
            data={CURRENCY_OPTIONS}
            allowDeselect={false}
            disabled={inactive}
            w={96}
            key={form.key(`${path}.currency`)}
            {...form.getInputProps(`${path}.currency`)}
          />
          <NumberInput
            aria-label={`Monto de ${label.toLowerCase()}`}
            placeholder={operationType === 'RENT' ? '450.000' : '95.000'}
            min={PRICE_LIMITS.amount.min}
            max={PRICE_LIMITS.amount.max}
            decimalScale={PRICE_LIMITS.amount.decimals}
            // Formato argentino al escribir: 95.000,50. El valor que guarda el
            // formulario sigue siendo un número (95000.5).
            decimalSeparator=","
            thousandSeparator="."
            allowNegative={false}
            disabled={inactive}
            style={{ flex: 1 }}
            key={form.key(`${path}.amount`)}
            {...form.getInputProps(`${path}.amount`)}
          />
        </Group>
      </Group>
    </Paper>
  )
}

export default function PropertyPrices({ form, disabled = false }) {
  return (
    <Stack gap="sm">
      {OPERATION_TYPE_OPTIONS.map(({ value, label }) => (
        <PriceRow key={value} form={form} operationType={value} label={label} disabled={disabled} />
      ))}
      <Text size="xs" c="dimmed">
        Un precio por operación: la propiedad puede estar en venta, en alquiler o en las dos.
      </Text>
    </Stack>
  )
}
