import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Pagination,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconChevronRight, IconFileText, IconPlus } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import {
  CONTRACT_ROLE_LABEL,
  CONTRACT_STATUS_COLOR,
  CONTRACT_STATUS_LABEL,
  CONTRACT_TYPE_LABEL,
  formatContractTerm,
  groupPartiesByContract,
  isContractOverdue,
  listAllParties,
  listContracts,
} from '../../../services/contracts.js'
import { findPerson } from '../../../services/people.js'
import { findProperty, formatPrice, formatPropertyPlace } from '../../../services/properties.js'

const PAGE_SIZE = 20

/**
 * Listado de contratos. Muestra las partes de cada uno, pero el backend no deja
 * pedirlas por contrato: se traen todas y se agrupan en el navegador.
 */
export default function ContractList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1)

  const [resultado, setResultado] = useState(null) // { page, data, parties, error }
  const cargando = resultado?.page !== page

  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }

    // Las partes no se pueden pedir por contrato: se traen todas y se agrupan.
    Promise.all([listContracts({ page: page - 1, size: PAGE_SIZE }, options), listAllParties(options)])
      // Se guardan agrupadas: { [contractId]: partes[] }, para buscar las de
      // cada fila directo por su id.
      .then(([data, parties]) =>
        setResultado({ page, data, parties: groupPartiesByContract(parties), error: null }),
      )
      .catch((err) => {
        if (!controller.signal.aborted) setResultado({ page, data: null, parties: {}, error: err.message })
      })

    return () => controller.abort()
  }, [page])

  const data = resultado?.data ?? null
  const error = resultado?.error ?? null
  const contracts = data?.content ?? []
  const partiesByContract = resultado?.parties ?? {}

  const properties = useLookup('properties', contracts.map((c) => c.propertyId), findProperty)
  // Todos los peopleId de las partes de los contratos de esta página.
  // `flatMap` junta las listas de cada contrato en una sola.
  const people = useLookup(
    'people',
    contracts.flatMap((c) => (partiesByContract[c.id] ?? []).map((p) => p.peopleId)),
    findPerson,
  )

  const irAPagina = (nuevaPagina) => setSearchParams({ page: String(nuevaPagina) })

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconFileText size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Contratos
            </Title>
            <Text c="dimmed">
              {data
                ? `${data.totalElements} ${data.totalElements === 1 ? 'contrato' : 'contratos'} de venta y alquiler`
                : error
                  ? 'Sin datos'
                  : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/contratos/nuevo" leftSection={<IconPlus size={16} />}>
          Nuevo contrato
        </Button>
      </Group>

      {cargando && resultado == null && (
        <Stack gap="xs">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={52} radius="md" />
          ))}
        </Stack>
      )}

      {error && (
        <Alert color="red" icon={<IconAlertTriangle />} title="No se pudo cargar el listado">
          {error}
        </Alert>
      )}

      {data?.content.length === 0 && (
        <Card withBorder radius="lg" padding="xl" shadow="xs">
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconFileText size={28} />
            </ThemeIcon>
            <Text fw={600}>Todavía no hay contratos</Text>
            <Button component={Link} to="/dashboard/contratos/nuevo" mt="md" variant="light">
              Cargar el primero
            </Button>
          </Stack>
        </Card>
      )}

      {contracts.length > 0 && (
        <>
          <Card
            withBorder
            radius="lg"
            padding={0}
            shadow="xs"
            style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            <Table.ScrollContainer minWidth={960}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Propiedad</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Partes</Table.Th>
                    <Table.Th ta="right">Monto</Table.Th>
                    <Table.Th>Vigencia</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {contracts.map((contract) => {
                    const property = properties[contract.propertyId]
                    const parties = partiesByContract[contract.id] ?? []
                    const detalle = `/dashboard/contratos/${contract.id}`

                    return (
                      <Table.Tr key={contract.id} style={{ cursor: 'pointer' }} onClick={() => navigate(detalle)}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {property?.address ?? `Propiedad #${contract.propertyId}`}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {property ? formatPropertyPlace(property) : `Contrato #${contract.id}`}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{CONTRACT_TYPE_LABEL[contract.type] ?? contract.type}</Text>
                        </Table.Td>
                        <Table.Td>
                          {parties.length === 0 ? (
                            <Text size="sm" c="orange">
                              Sin partes
                            </Text>
                          ) : (
                            parties.map((party) => (
                              <Text key={party.id} size="sm" style={{ whiteSpace: 'nowrap' }}>
                                <Text span size="xs" c="dimmed">
                                  {CONTRACT_ROLE_LABEL[party.role] ?? party.role}
                                </Text>{' '}
                                {people[party.peopleId]?.name ?? `#${party.peopleId}`}
                              </Text>
                            ))
                          )}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(contract)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                            {formatContractTerm(contract)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={CONTRACT_STATUS_COLOR[contract.status]}>
                            {CONTRACT_STATUS_LABEL[contract.status] ?? contract.status}
                          </Badge>
                          {/* Vigente pero con la fecha de fin ya pasada. */}
                          {isContractOverdue(contract) && (
                            <Badge variant="light" color="orange" ml={4}>
                              Vencido
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Button
                            component={Link}
                            to={detalle}
                            variant="subtle"
                            size="compact-sm"
                            rightSection={<IconChevronRight size={14} />}
                            onClick={(event) => event.stopPropagation()}
                          >
                            Abrir
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          {data.totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination total={data.totalPages} value={page} onChange={irAPagina} />
            </Group>
          )}
        </>
      )}
    </Container>
  )
}
