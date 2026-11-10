import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CloseButton,
  Container,
  Group,
  Input,
  NumberInput,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconChevronRight, IconCircleCheck, IconLink, IconLock } from '@tabler/icons-react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useLookup } from '../../../hooks/useLookup.js'
import { usePropertyOptions } from '../../../hooks/useSelectOptions.js'
import { findPerson } from '../../../services/people.js'
import { ownersOfProperty, propertyOwnersQuery, usePropertyOwners } from '../../../hooks/usePropertyOwners.js'
import { queryKeys } from '../../../queries/keys.js'
import { NotFound } from '../../../components/NotFound.jsx'
import { ApiError, isNotFound } from '../../../services/api.js'
import {
  CONTRACT_LIMITS,
  CONTRACT_ROLE_LABEL,
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  contractConflictMessage,
  createContract,
  createParty,
  findContract,
  toContractFormValues,
  toContractRequest,
  toPartyRequest,
  updateContract,
} from '../../../services/contracts.js'
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  OPERATION_TYPE_LABEL,
  findProperty,
  formatAmount,
  formatPrice,
} from '../../../services/properties.js'
import { contractDefaultValues, contractValidation, todayISO } from './contract-form.js'

const LIST_PATH = '/dashboard/contratos'

function PageHeader({ contractId }) {
  return (
    <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Container size="md" py="xl">
        <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
          <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" fw={600}>
            Contratos
          </Anchor>
          {contractId && (
            <Anchor component={Link} to={`${LIST_PATH}/${contractId}`} size="xs" c="dimmed" fw={600}>
              Contrato #{contractId}
            </Anchor>
          )}
          <Text size="xs" c="var(--mantine-primary-color-filled)" fw={600}>
            {contractId ? 'Editar' : 'Nuevo contrato'}
          </Text>
        </Breadcrumbs>
        <Title order={1} size="h2" mb={4}>
          {contractId ? `Editar contrato #${contractId}` : 'Nuevo contrato'}
        </Title>
        <Text c="dimmed">
          {contractId
            ? 'La propiedad no se puede cambiar. Las partes se administran desde el detalle del contrato.'
            : 'Los propietarios son los dueños de la propiedad y se agregan solos. Después, en el detalle, se cargan el inquilino o comprador y los garantes.'}
        </Text>
      </Container>
    </Box>
  )
}

/** Fecha de fin: no aplica a una venta. Se suscribe solo a `type`. */
// Componente aparte para que solo él se redibuje al cambiar el tipo: el resto
// del formulario es no controlado y no se entera del cambio.
function EndDateInput({ form }) {
  const type = form.useWatchValue('type')
  const startDate = form.useWatchValue('startDate')
  const isSale = type === 'SALE'
  const today = todayISO()

  return (
    <TextInput
      label="Fin"
      type="date"
      description={isSale ? 'Una venta no tiene fecha de fin' : 'Opcional'}
      disabled={isSale}
      min={startDate && startDate > today ? startDate : today}
      key={form.key('endDate')}
      {...form.getInputProps('endDate')}
    />
  )
}

/**
 * Tipo, estado, moneda y monto. El tipo se limita a las operaciones que la
 * propiedad tiene publicadas (sus precios): si solo se vende, solo "Venta".
 * La moneda y el placeholder del monto salen del precio de esa operación.
 */
function TermsFields({ form, isEdit, fromOffer }) {
  const propertyId = form.useWatchValue('propertyId')
  const type = form.useWatchValue('type')

  const property = useQuery({
    queryKey: queryKeys.properties.detail(propertyId),
    queryFn: ({ signal }) => findProperty(propertyId, { signal }),
    enabled: Boolean(propertyId),
  })
  const prices = property.data?.prices ?? []
  const offered = new Set(prices.map((p) => p.operationType))
  // Sin precios cargados no se sabe la operación: se ofrecen las dos.
  const typeOptions =
    offered.size === 0
      ? CONTRACT_TYPE_OPTIONS
      : CONTRACT_TYPE_OPTIONS.filter((o) => offered.has(o.value) || (isEdit && o.value === type))
  const price = prices.find((p) => p.operationType === type)

  // Si el tipo elegido no está entre los de la propiedad, se pasa al que hay.
  const allowedKey = typeOptions.map((o) => o.value).join(',')
  useEffect(() => {
    if (!property.data || typeOptions.some((o) => o.value === type)) return
    form.setFieldValue('type', typeOptions[0].value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.data, allowedKey, type])

  // En un alta, la moneda sigue a la del precio de la operación (o la
  // habitual: USD para venta, ARS para alquiler). En una edición se respeta
  // la guardada, y si viene de una oferta aceptada, la de la oferta.
  const currency = price?.currency ?? DEFAULT_CURRENCY[type]
  useEffect(() => {
    if (isEdit || fromOffer || !currency) return
    if (form.getValues().currency !== currency) form.setFieldValue('currency', currency)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, fromOffer, currency])

  const amountPlaceholder = price
    ? formatAmount(price.amount)
    : type === 'SALE'
      ? '95.000'
      : '450.000'

  let typeDescription
  if (propertyId && property.data && offered.size === 1) {
    typeDescription = `La propiedad solo se ofrece en ${OPERATION_TYPE_LABEL[[...offered][0]].toLowerCase()}.`
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label="Tipo"
          description={typeDescription}
          data={typeOptions}
          allowDeselect={false}
          withAsterisk
          key={form.key('type')}
          {...form.getInputProps('type')}
        />
        <Select
          label="Estado"
          description={isEdit ? undefined : 'Un contrato nuevo empieza vigente.'}
          data={isEdit ? CONTRACT_STATUS_OPTIONS : CONTRACT_STATUS_OPTIONS.filter((o) => o.value === 'ACTIVE')}
          allowDeselect={false}
          disabled={!isEdit}
          withAsterisk
          key={form.key('status')}
          {...form.getInputProps('status')}
        />
      </SimpleGrid>

      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Select
          label="Moneda"
          data={CURRENCY_OPTIONS}
          allowDeselect={false}
          withAsterisk
          w={110}
          key={form.key('currency')}
          {...form.getInputProps('currency')}
        />
        <NumberInput
          label="Monto"
          description={
            fromOffer
              ? `Monto de la oferta aceptada${price ? ` (precio publicado: ${formatPrice(price)})` : ''}`
              : price
                ? `Precio publicado: ${formatPrice(price)}`
                : undefined
          }
          placeholder={amountPlaceholder}
          min={CONTRACT_LIMITS.amount.min}
          max={CONTRACT_LIMITS.amount.max}
          decimalScale={CONTRACT_LIMITS.amount.decimals}
          decimalSeparator=","
          thousandSeparator="."
          allowNegative={false}
          withAsterisk
          style={{ flex: 1 }}
          key={form.key('amount')}
          {...form.getInputProps('amount')}
        />
      </Group>
    </>
  )
}

/**
 * Propietarios del contrato nuevo: los dueños de la propiedad elegida, solo
 * para ver. Se cargan solos al crear el contrato y no se pueden cambiar.
 */
function OwnersField({ form }) {
  const propertyId = form.useWatchValue('propertyId')
  const owners = usePropertyOwners(propertyId)

  let content
  if (!propertyId) {
    content = <Text size="sm" c="dimmed">Se completan al elegir la propiedad.</Text>
  } else if (owners.error) {
    content = <Text size="sm" c="danger">No se pudieron cargar los dueños: {owners.error}</Text>
  } else if (!owners.loaded) {
    content = <Text size="sm" c="dimmed">Cargando dueños...</Text>
  } else if (owners.options.length === 0) {
    content = (
      <Text size="sm" c="danger">
        La propiedad no tiene dueños cargados. Cárguelos en la{' '}
        <Anchor component={Link} to={`/dashboard/propiedades/${propertyId}/editar`} size="sm">
          edición de la propiedad
        </Anchor>{' '}
        antes de crear el contrato.
      </Text>
    )
  } else {
    content = (
      <Group gap="xs">
        {owners.options.map((o) => (
          <Badge key={o.value} variant="light" color="gray" size="lg" tt="none" leftSection={<IconLock size={12} />}>
            {o.label}
          </Badge>
        ))}
      </Group>
    )
  }

  return (
    <Input.Wrapper
      label={owners.options.length > 1 ? 'Propietarios' : 'Propietario'}
      description="Los dueños de la propiedad. Se agregan solos al contrato y no se pueden cambiar."
    >
      <Box mt={6}>{content}</Box>
    </Input.Wrapper>
  )
}

/** Rol de la contraparte que llega de una oferta aceptada, según el tipo de contrato. */
const counterpartRole = (type) => (type === 'SALE' ? 'BUYER' : 'TENANT')

/**
 * Comprador o inquilino del contrato nuevo: el interesado de la consulta cuya
 * oferta se aceptó. Viene precargado pero se puede quitar (puede firmar otra
 * persona); en ese caso se carga después desde el detalle del contrato.
 */
function CounterpartField({ form, presetPeopleId }) {
  const type = form.useWatchValue('type')
  const propertyId = form.useWatchValue('propertyId')
  const peopleId = form.useWatchValue('counterpartPeopleId')
  const owners = usePropertyOwners(propertyId)
  const people = useLookup('people', [presetPeopleId], findPerson)

  const roleLabel = CONTRACT_ROLE_LABEL[counterpartRole(type)]
  const person = people[presetPeopleId]
  const isOwner = owners.owners.some((o) => o.peopleId === Number(presetPeopleId))

  let content
  if (isOwner) {
    content = (
      <Text size="sm" c="dimmed">
        El interesado ya es dueño de la propiedad: no se agrega como {roleLabel.toLowerCase()}.
      </Text>
    )
  } else if (peopleId) {
    content = (
      <Badge
        variant="light"
        color="success"
        size="lg"
        tt="none"
        rightSection={
          <CloseButton
            size="xs"
            variant="transparent"
            aria-label={`Quitar ${roleLabel.toLowerCase()}`}
            onClick={() => form.setFieldValue('counterpartPeopleId', null)}
          />
        }
      >
        {person ? `${person.name} · ${person.phone}` : `Persona #${presetPeopleId}`}
      </Badge>
    )
  } else {
    content = (
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          Sin {roleLabel.toLowerCase()}: se carga desde el detalle del contrato.
        </Text>
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => form.setFieldValue('counterpartPeopleId', String(presetPeopleId))}
        >
          Volver a agregar al interesado
        </Button>
      </Group>
    )
  }

  return (
    <Input.Wrapper
      label={roleLabel}
      description="El interesado de la oferta aceptada. Se agrega solo al contrato; quítelo si firma otra persona."
    >
      <Box mt={6}>{content}</Box>
    </Input.Wrapper>
  )
}

/**
 * Valores del alta que llegan en la URL: `propertyId`, y `amount` + `currency`
 * + `peopleId` desde una oferta aceptada. Se descarta lo que no sea válido.
 */
function presetFromSearch(searchParams) {
  const preset = { propertyId: searchParams.get('propertyId') }
  const peopleId = Number(searchParams.get('peopleId'))
  if (Number.isInteger(peopleId) && peopleId > 0) preset.counterpartPeopleId = String(peopleId)
  const amount = Number(searchParams.get('amount'))
  if (searchParams.has('amount') && Number.isFinite(amount) && amount >= CONTRACT_LIMITS.amount.min) {
    preset.amount = amount
  }
  const currency = searchParams.get('currency')
  if (preset.amount != null && CURRENCY_OPTIONS.some((o) => o.value === currency)) {
    preset.currency = currency
  }
  return preset
}

function ContractEditor({ contract }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)
  const isEdit = contract != null

  // En un alta se puede llegar con `?propertyId=` para dejar la propiedad
  // elegida, y con `?amount=&currency=` (una oferta aceptada) para el monto.
  const preset = isEdit ? {} : presetFromSearch(searchParams)
  const initialValues = isEdit ? toContractFormValues(contract) : { ...contractDefaultValues, ...preset }
  const properties = usePropertyOptions(initialValues.propertyId)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues,
    validateInputOnBlur: true,
    validate: contractValidation({ isEdit, initialValues }),
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'saving' })

    try {
      const request = toContractRequest(values)
      let saved
      if (isEdit) {
        saved = await updateContract(contract.id, request, { signal: controller.signal })
      } else {
        // Los propietarios son los dueños de la propiedad: sin dueños no se crea.
        const owners = ownersOfProperty(await queryClient.fetchQuery(propertyOwnersQuery), values.propertyId)
        if (owners.length === 0) {
          setStatus({
            state: 'error',
            message: 'La propiedad no tiene dueños cargados. Cárguelos en la edición de la propiedad antes de crear el contrato.',
          })
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return
        }
        saved = await createContract(request, { signal: controller.signal })
        const parties = owners.map((owner) => ({ peopleId: owner.peopleId, role: 'OWNER', comments: owner.comments }))
        // El interesado de la oferta aceptada, si no lo quitaron y no es ya dueño.
        const counterpartId = Number(values.counterpartPeopleId)
        if (counterpartId && !owners.some((o) => o.peopleId === counterpartId)) {
          parties.push({ peopleId: counterpartId, role: counterpartRole(values.type) })
        }
        // Si alguna falla, el contrato ya existe: el detalle avisa que falta
        // la parte y permite agregarla desde ahí.
        await Promise.allSettled(
          parties.map((party) => createParty(toPartyRequest(saved.id, party), { signal: controller.signal })),
        )
      }
      // El listado y el detalle de contratos se vuelven a pedir.
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
      // En los dos casos se va al detalle; el `state` dice qué aviso mostrar.
      // Después de un alta, ahí se cargan las partes.
      navigate(`${LIST_PATH}/${saved.id}`, { state: { saved: isEdit ? 'updated' : 'created' } })
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.hasFieldErrors) form.setErrors(error.fieldErrors)
      const message =
        error instanceof ApiError && error.status === 409
          ? contractConflictMessage(error.message)
          : error.message
      setStatus({ state: 'error', message })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit)(event)
  const isSaving = status.state === 'saving'

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader contractId={contract?.id} />

      <Container size="md" py="xl">
        {status.state === 'error' && (
          <Alert
            color="danger"
            icon={<IconAlertTriangle />}
            title={isEdit ? 'No se pudieron guardar los cambios' : 'No se pudo crear el contrato'}
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            {status.message}
          </Alert>
        )}

        <Card withBorder radius="lg" padding="xl">
          <Stack>
            <Select
              label="Propiedad"
              placeholder={properties.state === 'loading' ? 'Cargando propiedades...' : 'Elegir'}
              description={
                isEdit
                  ? 'Un contrato no cambia de propiedad.'
                  : properties.state === 'error'
                    ? `No se pudieron cargar: ${properties.message}`
                    : undefined
              }
              data={properties.options}
              searchable
              nothingFoundMessage="Sin coincidencias"
              disabled={isEdit || properties.state === 'loading'}
              withAsterisk
              key={form.key('propertyId')}
              {...form.getInputProps('propertyId')}
            />

            {!isEdit && <OwnersField form={form} />}

            {preset.counterpartPeopleId && (
              <CounterpartField form={form} presetPeopleId={preset.counterpartPeopleId} />
            )}

            <TermsFields form={form} isEdit={isEdit} fromOffer={preset.currency != null} />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {/* `type="date"` usa el calendario del navegador. Su valor es
                  "yyyy-MM-dd", el mismo formato del LocalDate del backend.
                  `min` impide elegir días pasados en el calendario; en una
                  edición se deja la fecha ya guardada. */}
              <TextInput
                label="Inicio"
                type="date"
                min={isEdit && initialValues.startDate < todayISO() ? initialValues.startDate : todayISO()}
                withAsterisk
                key={form.key('startDate')}
                {...form.getInputProps('startDate')}
              />
              <EndDateInput form={form} />
            </SimpleGrid>

            <TextInput
              label="Documento"
              description="Link al contrato firmado (PDF en Drive, Dropbox, etc.)"
              placeholder="https://..."
              leftSection={<IconLink size={16} />}
              withAsterisk
              key={form.key('documentURL')}
              {...form.getInputProps('documentURL')}
            />
          </Stack>

          <Group justify="flex-end" mt="xl">
            <Button
              component={Link}
              to={isEdit ? `${LIST_PATH}/${contract.id}` : LIST_PATH}
              variant="subtle"
              color="gray"
              disabled={isSaving}
            >
              Volver
            </Button>
            <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={isSaving}>
              {isEdit ? 'Guardar cambios' : 'Crear contrato'}
            </Button>
          </Group>
        </Card>
      </Container>
    </form>
  )
}

function ContractLoader({ id }) {
  const query = useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: ({ signal }) => findContract(id, { signal }),
  })

  // Si ya hay datos se usan aunque falle una recarga en segundo plano (ver PropertyLoader).
  const result = query.data
    ? { contract: query.data }
    : query.isError
      ? { error: query.error.message, notFound: isNotFound(query.error) }
      : null

  if (result?.contract) return <ContractEditor contract={result.contract} />

  if (result?.notFound) {
    return (
      <NotFound
        title={`El contrato #${id} no existe`}
        description="No se puede editar un contrato que no existe. Puede que la dirección esté mal."
        back={{ to: LIST_PATH, label: 'Volver a contratos' }}
      />
    )
  }

  return (
    <>
      <PageHeader contractId={id} />
      <Container size="md" py="xl">
        {result?.error ? (
          <Alert color="danger" icon={<IconAlertTriangle />} title="No se puede editar el contrato">
            {result.error}{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Volver al listado
            </Anchor>
          </Alert>
        ) : (
          <Skeleton height={420} radius="lg" />
        )}
      </Container>
    </>
  )
}

/** `/contratos/nuevo` y `/contratos/:id/editar`. */
export default function ContractForm() {
  const { id } = useParams()
  return id ? <ContractLoader key={id} id={id} /> : <ContractEditor key="new" />
}
