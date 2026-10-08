import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconBan,
  IconChevronRight,
  IconCircleCheck,
  IconExternalLink,
  IconFileText,
  IconPencil,
  IconUsers,
} from '@tabler/icons-react'

import ConfirmAction from '../../../components/ConfirmAction.jsx'
import { useLookup } from '../../../hooks/useLookup.js'
import { ApiError } from '../../../services/api.js'
import {
  CONTRACT_STATUS_COLOR,
  CONTRACT_STATUS_LABEL,
  CONTRACT_TYPE_LABEL,
  cancelContract,
  findContract,
  formatContractTerm,
  isContractOverdue,
  listContractParties,
} from '../../../services/contracts.js'
import { formatDateTime } from '../../../services/format.js'
import { findProperty, formatPrice, formatPropertyPlace } from '../../../services/properties.js'
import ContractParties from './ContractParties.jsx'

const LIST_PATH = '/dashboard/contratos'

const SAVED_MESSAGE = {
  created: { title: 'Contrato creado', body: 'Agregue las partes: propietario, inquilino o comprador y garantes.' },
  updated: { title: 'Cambios guardados', body: null },
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs">
      <Group gap="sm" mb="md" wrap="nowrap">
        <ThemeIcon variant="light" size={34} radius="md">
          <Icon size={18} />
        </ThemeIcon>
        <Title order={2} size="h5">
          {title}
        </Title>
      </Group>
      {children}
    </Card>
  )
}

function InfoRow({ label, children }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm">{children}</Text>
    </div>
  )
}

/** Trae el contrato y sus partes. `version` fuerza la recarga. */
function useContractData(id) {
  const [version, setVersion] = useState(0)
  const [data, setData] = useState(null) // { contract, parties } | { error }

  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }

    Promise.all([findContract(id, options), listContractParties(id, options)])
      .then(([contract, parties]) => setData({ contract, parties }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setData((current) => ({
          ...current,
          error:
            error instanceof ApiError && error.status === 404
              ? `No existe un contrato con el identificador #${id}.`
              : error.message,
        }))
      })

    return () => controller.abort()
  }, [id, version])

  return { data, reload: () => setVersion((v) => v + 1) }
}

/** Detalle de un contrato: sus datos, sus partes y la acción de cancelarlo. */
export default function ContractDetail() {
  const { id } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { data, reload } = useContractData(id)
  const [saved, setSaved] = useState(location.state?.saved ?? null)
  const [action, setAction] = useState({ state: 'idle' })

  const contract = data?.contract
  const property = useLookup('properties', [contract?.propertyId], findProperty)[contract?.propertyId]

  if (!contract) {
    return (
      <Container size="xl" py="xl">
        {data?.error ? (
          <Alert color="red" icon={<IconAlertTriangle />} title="No se pudo abrir el contrato">
            {data.error}{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Volver al listado
            </Anchor>
          </Alert>
        ) : (
          <Stack>
            <Skeleton height={90} radius="lg" />
            <Skeleton height={320} radius="lg" />
          </Stack>
        )}
      </Container>
    )
  }

  // "Cancelar" usa el DELETE del backend, que no borra: pasa el contrato a CANCELLED.
  const cancel = async () => {
    setAction({ state: 'saving' })
    try {
      await cancelContract(contract.id)
      setAction({ state: 'idle' })
    } catch (error) {
      setAction({ state: 'error', message: error.message })
    }
    reload()
  }

  const savedMessage = SAVED_MESSAGE[saved]
  // Cancelar es para un contrato que se cae: uno finalizado ya cumplió su ciclo.
  const canCancel = contract.status === 'ACTIVE'
  const overdue = isContractOverdue(contract)

  return (
    <>
      <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="xl" py="xl">
          <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
            <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
              Contratos
            </Anchor>
            <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
              Contrato #{contract.id}
            </Text>
          </Breadcrumbs>
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={1} size="h2" mb={4}>
                {CONTRACT_TYPE_LABEL[contract.type] ?? contract.type} ·{' '}
                {property?.address ?? `Propiedad #${contract.propertyId}`}
              </Title>
              <Text c="dimmed">
                {formatPrice(contract)} · {formatContractTerm(contract)}
              </Text>
            </div>
            <Group gap="sm">
              <Badge size="lg" variant="light" color={CONTRACT_STATUS_COLOR[contract.status]}>
                {CONTRACT_STATUS_LABEL[contract.status] ?? contract.status}
              </Badge>
              <Button
                component={Link}
                to={`${LIST_PATH}/${contract.id}/editar`}
                variant="default"
                leftSection={<IconPencil size={16} />}
              >
                Editar
              </Button>
              {canCancel && (
                <ConfirmAction label="¿Cancelar el contrato?" disabled={action.state === 'saving'} onConfirm={cancel}>
                  {(props) => (
                    <Button variant="light" color="red" leftSection={<IconBan size={16} />} {...props}>
                      Cancelar contrato
                    </Button>
                  )}
                </ConfirmAction>
              )}
            </Group>
          </Group>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        {savedMessage && (
          <Alert
            color="teal"
            icon={<IconCircleCheck />}
            title={savedMessage.title}
            mb="lg"
            withCloseButton
            onClose={() => setSaved(null)}
          >
            {savedMessage.body}
          </Alert>
        )}
        {overdue && (
          <Alert color="orange" icon={<IconAlertTriangle />} title="Contrato vencido" mb="lg">
            Figura como vigente, pero la fecha de fin ya pasó. Si terminó, edítelo y páselo a
            finalizado.{' '}
            <Anchor component={Link} to={`${LIST_PATH}/${contract.id}/editar`} size="sm" fw={500}>
              Editar contrato
            </Anchor>
          </Alert>
        )}
        {action.state === 'error' && (
          <Alert
            color="red"
            icon={<IconAlertTriangle />}
            title="No se pudo cancelar el contrato"
            mb="lg"
            withCloseButton
            onClose={() => setAction({ state: 'idle' })}
          >
            {action.message}
          </Alert>
        )}
        {data.error && (
          <Alert color="orange" icon={<IconAlertTriangle />} title="No se pudo recargar" mb="lg">
            {data.error}
          </Alert>
        )}

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <SectionCard icon={IconUsers} title="Partes">
              <ContractParties
                contract={contract}
                parties={data.parties}
                initialPeopleId={searchParams.get('peopleId')}
                onChanged={reload}
              />
            </SectionCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 5 }}>
            <SectionCard icon={IconFileText} title="Datos del contrato">
              <Stack gap="sm">
                <InfoRow label="Propiedad">
                  {property ? (
                    <>
                      {property.address}, {formatPropertyPlace(property)}{' '}
                      <Anchor component={Link} to={`/dashboard/propiedades/${property.id}/editar`} size="sm">
                        Ver
                      </Anchor>
                    </>
                  ) : (
                    `Propiedad #${contract.propertyId} (dada de baja o inexistente)`
                  )}
                </InfoRow>
                <InfoRow label="Tipo">{CONTRACT_TYPE_LABEL[contract.type] ?? contract.type}</InfoRow>
                <InfoRow label="Monto">{formatPrice(contract)}</InfoRow>
                <InfoRow label="Vigencia">{formatContractTerm(contract)}</InfoRow>
                <InfoRow label="Documento">
                  {/* Solo se muestra como link si es http o https: el texto lo cargó
                      un usuario y un `javascript:...` ejecutaría código al hacer clic.
                      `rel="noreferrer"` evita que la pestaña nueva acceda a esta. */}
                  {/^https?:\/\//i.test(contract.documentURL ?? '') ? (
                    <Anchor href={contract.documentURL} target="_blank" rel="noreferrer" size="sm">
                      Abrir documento <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                    </Anchor>
                  ) : (
                    contract.documentURL
                  )}
                </InfoRow>
                <InfoRow label="Última modificación">{formatDateTime(contract.updatedAt)}</InfoRow>
              </Stack>
            </SectionCard>
          </Grid.Col>
        </Grid>
      </Container>
    </>
  )
}
