import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ActionIcon,
  Alert,
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
import { IconAlertTriangle, IconPencil, IconPlus, IconUsersGroup } from '@tabler/icons-react'

import { useLookup } from '../../../hooks/useLookup.js'
import { findAgency } from '../../../services/agencies.js'
import { formatDate } from '../../../services/format.js'
import { listPeople } from '../../../services/people.js'

const PAGE_SIZE = 20

export default function PeopleList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1)

  const [resultado, setResultado] = useState(null) // { page, data, error }
  const cargando = resultado?.page !== page

  useEffect(() => {
    const controller = new AbortController()

    listPeople({ page: page - 1, size: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => setResultado({ page, data, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setResultado({ page, data: null, error: err.message })
      })

    return () => controller.abort()
  }, [page])

  const data = resultado?.data ?? null
  const error = resultado?.error ?? null
  const agencies = useLookup('agencies', data?.content.map((p) => p.agencyId) ?? [], findAgency)

  const irAPagina = (nuevaPagina) => setSearchParams({ page: String(nuevaPagina) })

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md">
            <IconUsersGroup size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">
              Personas
            </Title>
            <Text c="dimmed">
              {data
                ? `${data.totalElements} ${data.totalElements === 1 ? 'persona' : 'personas'}, en el orden en que se cargaron`
                : 'Cargando el listado...'}
            </Text>
          </div>
        </Group>

        <Button component={Link} to="/dashboard/personas/nueva" leftSection={<IconPlus size={16} />}>
          Nueva persona
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
              <IconUsersGroup size={28} />
            </ThemeIcon>
            <Text fw={600}>Todavía no hay personas cargadas</Text>
            <Button component={Link} to="/dashboard/personas/nueva" mt="md" variant="light">
              Cargar la primera
            </Button>
          </Stack>
        </Card>
      )}

      {data?.content.length > 0 && (
        <>
          <Card
            withBorder
            radius="lg"
            padding={0}
            shadow="xs"
            style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity 150ms' }}
          >
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Contacto</Table.Th>
                    <Table.Th>Documento</Table.Th>
                    <Table.Th>Inmobiliaria</Table.Th>
                    <Table.Th>Alta</Table.Th>
                    <Table.Th w={1} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.content.map((persona) => (
                    <Table.Tr key={persona.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {persona.name}
                        </Text>
                        {persona.address && (
                          <Text size="xs" c="dimmed">
                            {persona.address}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{persona.email}</Text>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {persona.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {persona.dni ? `DNI ${persona.dni}` : '—'}
                        </Text>
                        {persona.cuit && (
                          <Text size="xs" c="dimmed" ff="monospace">
                            CUIT {persona.cuit}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {agencies[persona.agencyId]?.publicName ?? `#${persona.agencyId}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(persona.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          component={Link}
                          to={`/dashboard/personas/${persona.id}/editar`}
                          variant="subtle"
                          aria-label={`Editar ${persona.name}`}
                        >
                          <IconPencil size={18} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
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
