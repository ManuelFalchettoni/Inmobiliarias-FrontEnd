import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
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
import { IconAlertTriangle, IconChevronRight, IconCircleCheck, IconLink } from '@tabler/icons-react'

import { usePropertyOptions } from '../../../hooks/useSelectOptions.js'
import { ApiError } from '../../../services/api.js'
import {
  CONTRACT_LIMITS,
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  createContract,
  findContract,
  toContractFormValues,
  toContractRequest,
  updateContract,
} from '../../../services/contracts.js'
import { CURRENCY_OPTIONS } from '../../../services/properties.js'
import { contractDefaultValues, contractValidation } from './contract-form.js'

const LIST_PATH = '/dashboard/contratos'

function PageHeader({ contractId }) {
  return (
    <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Container size="md" py="xl">
        <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
          <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
            Contratos
          </Anchor>
          {contractId && (
            <Anchor component={Link} to={`${LIST_PATH}/${contractId}`} size="xs" c="dimmed" tt="uppercase" fw={600}>
              Contrato #{contractId}
            </Anchor>
          )}
          <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
            {contractId ? 'Editar' : 'Nuevo contrato'}
          </Text>
        </Breadcrumbs>
        <Title order={1} size="h2" mb={4}>
          {contractId ? `Editar contrato #${contractId}` : 'Nuevo contrato'}
        </Title>
        <Text c="dimmed">
          {contractId
            ? 'La propiedad no se puede cambiar. Las partes se administran desde el detalle del contrato.'
            : 'Primero se cargan los datos del contrato; después, en el detalle, se agregan las partes: propietario, inquilino o comprador y garantes.'}
        </Text>
      </Container>
    </Box>
  )
}

/** Fecha de fin: no aplica a una venta. Se suscribe solo a `type`. */
function EndDateInput({ form }) {
  const type = form.useWatchValue('type')
  const isSale = type === 'SALE'

  return (
    <TextInput
      label="Fin"
      type="date"
      description={isSale ? 'Una venta no tiene fecha de fin' : 'Opcional'}
      disabled={isSale}
      key={form.key('endDate')}
      {...form.getInputProps('endDate')}
    />
  )
}

function ContractEditor({ contract }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState({ state: 'idle' })
  const abortRef = useRef(null)
  const isEdit = contract != null

  const initialValues = isEdit
    ? toContractFormValues(contract)
    : { ...contractDefaultValues, propertyId: searchParams.get('propertyId') }
  const properties = usePropertyOptions(initialValues.propertyId)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues,
    validateInputOnBlur: true,
    validate: contractValidation,
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'saving' })

    try {
      const request = toContractRequest(values)
      const saved = isEdit
        ? await updateContract(contract.id, request, { signal: controller.signal })
        : await createContract(request, { signal: controller.signal })
      navigate(`${LIST_PATH}/${saved.id}`, { state: { saved: isEdit ? 'updated' : 'created' } })
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.hasFieldErrors) form.setErrors(error.fieldErrors)
      setStatus({ state: 'error', message: error.message })
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
            color="red"
            icon={<IconAlertTriangle />}
            title={isEdit ? 'No se pudieron guardar los cambios' : 'No se pudo crear el contrato'}
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            {status.message}
          </Alert>
        )}

        <Card withBorder radius="lg" padding="xl" shadow="xs">
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

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Tipo"
                data={CONTRACT_TYPE_OPTIONS}
                allowDeselect={false}
                withAsterisk
                key={form.key('type')}
                {...form.getInputProps('type')}
              />
              <Select
                label="Estado"
                data={CONTRACT_STATUS_OPTIONS}
                allowDeselect={false}
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
                placeholder="450.000"
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

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Inicio"
                type="date"
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
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    findContract(id, { signal: controller.signal })
      .then((contract) => setResult({ contract }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setResult({
          error:
            error instanceof ApiError && error.status === 404
              ? `No existe un contrato con el identificador #${id}.`
              : error.message,
        })
      })
    return () => controller.abort()
  }, [id])

  if (result?.contract) return <ContractEditor contract={result.contract} />

  return (
    <>
      <PageHeader contractId={id} />
      <Container size="md" py="xl">
        {result?.error ? (
          <Alert color="red" icon={<IconAlertTriangle />} title="No se puede editar el contrato">
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
