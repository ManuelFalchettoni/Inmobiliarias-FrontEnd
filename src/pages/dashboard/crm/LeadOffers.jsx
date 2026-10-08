import { useState } from 'react'
import { ActionIcon, Badge, Button, Group, NumberInput, Paper, Select, Stack, Text } from '@mantine/core'
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react'

import {
  OFFER_LIMITS,
  OFFER_STATUS_COLOR,
  OFFER_STATUS_LABEL,
  acceptOffer,
  deleteOffer,
  registerOffer,
  rejectOffer,
} from '../../../services/crm.js'
import { formatDate } from '../../../services/format.js'
import { CURRENCY_OPTIONS, formatPrice } from '../../../services/properties.js'
import ConfirmAction from '../../../components/ConfirmAction.jsx'

function NewOfferForm({ lead, onSaved }) {
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState({ state: 'idle' })

  const submit = async (event) => {
    event.preventDefault()
    const value = Number(amount)
    // Validación a mano (este formulario no usa Mantine Form). `!(value >= min)`
    // también atrapa NaN, que no es mayor ni menor que nada.
    if (amount === '' || !(value >= OFFER_LIMITS.amount.min)) {
      setStatus({ state: 'error', message: 'Indique un monto mayor a 0.' })
      return
    }

    setStatus({ state: 'saving' })
    try {
      // Flujo completo: crea la oferta, deja el evento y adelanta la etapa (crm.js).
      const result = await registerOffer(lead, { amount: value, currency, status: 'PENDING' })
      setAmount('')
      setStatus({ state: 'idle' })
      onSaved(result.lead)
    } catch (error) {
      setStatus({ state: 'error', message: error.message })
      // Puede haber fallado un paso posterior a crear la oferta: se recarga igual.
      onSaved()
    }
  }

  return (
    <form onSubmit={submit}>
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Select
          aria-label="Moneda de la oferta"
          data={CURRENCY_OPTIONS}
          value={currency}
          onChange={(value) => value && setCurrency(value)}
          allowDeselect={false}
          w={84}
        />
        <NumberInput
          aria-label="Monto de la oferta"
          placeholder="Monto"
          value={amount}
          onChange={setAmount}
          min={OFFER_LIMITS.amount.min}
          max={OFFER_LIMITS.amount.max}
          decimalScale={OFFER_LIMITS.amount.decimals}
          decimalSeparator=","
          thousandSeparator="."
          allowNegative={false}
          style={{ flex: 1 }}
        />
        <Button type="submit" loading={status.state === 'saving'}>
          Cargar
        </Button>
      </Group>
      {status.state === 'error' && (
        <Text size="sm" c="red" mt={4}>
          {status.message}
        </Text>
      )}
    </form>
  )
}

/**
 * Ofertas del lead, las más nuevas primero. Cargar una la deja pendiente y
 * pasa el lead a negociación; aceptarla lo da por ganado.
 */
export default function LeadOffers({ lead, offers, onChanged }) {
  // Id de la oferta en proceso (para atenuarla y bloquear los botones).
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  // Mismo patrón que PropertyOwners: `action` es la función con el pedido.
  const run = async (offer, action) => {
    setBusyId(offer.id)
    setError(null)
    try {
      const updatedLead = await action()
      onChanged(updatedLead)
    } catch (err) {
      setError(err.message)
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Stack gap="sm">
      <NewOfferForm lead={lead} onSaved={onChanged} />

      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      {offers.length === 0 && (
        <Text size="sm" c="dimmed">
          Sin ofertas.
        </Text>
      )}

      {offers.map((offer) => (
        <Paper key={offer.id} withBorder radius="md" p="sm" style={{ opacity: busyId === offer.id ? 0.6 : 1 }}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <div>
              <Text fw={600}>{formatPrice(offer)}</Text>
              <Text size="xs" c="dimmed">
                {formatDate(offer.createdAt)}
              </Text>
            </div>
            <Badge variant="light" color={OFFER_STATUS_COLOR[offer.status]}>
              {OFFER_STATUS_LABEL[offer.status] ?? offer.status}
            </Badge>
          </Group>

          <Group gap="xs" mt="xs" justify="flex-end">
            {/* Solo una oferta pendiente se puede aceptar o rechazar. */}
            {offer.status === 'PENDING' && (
              <>
                <Button
                  size="compact-sm"
                  variant="light"
                  color="teal"
                  leftSection={<IconCheck size={14} />}
                  disabled={busyId != null}
                  onClick={() => run(offer, async () => (await acceptOffer(lead, offer)).lead)}
                >
                  Aceptar
                </Button>
                <Button
                  size="compact-sm"
                  variant="light"
                  color="red"
                  leftSection={<IconX size={14} />}
                  disabled={busyId != null}
                  onClick={() =>
                    run(offer, async () => {
                      await rejectOffer(lead, offer)
                    })
                  }
                >
                  Rechazar
                </Button>
              </>
            )}
            <ConfirmAction
              label="¿Borrar?"
              disabled={busyId != null}
              onConfirm={() =>
                run(offer, async () => {
                  await deleteOffer(lead.id, offer.id)
                })
              }
            >
              {(props) => (
                <ActionIcon variant="subtle" color="gray" aria-label="Borrar oferta cargada por error" {...props}>
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </ConfirmAction>
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}
