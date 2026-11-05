import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Box, Card, Container, Group, SegmentedControl, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconArchive, IconBuildingEstate, IconBuildingSkyscraper, IconUsers } from '@tabler/icons-react'

import { useAuth } from '../../../context/auth-context.js'
import { queryKeys } from '../../../queries/keys.js'
import {
  AGENCY_STATUS_COLOR,
  AGENCY_STATUS_SHORT_LABEL,
  formatCuit,
  listAgencies,
  restoreAgency,
} from '../../../services/agencies.js'
import {
  PROPERTY_TYPE_LABEL,
  formatPropertyPlace,
  listProperties,
  restoreProperty,
} from '../../../services/properties.js'
import { USER_ROL_COLOR, USER_ROL_LABEL, listUsers, restoreUser } from '../../../services/users.js'
import ArchivedSection, { RowBadge } from './ArchivedSection.jsx'
import { archivedParams } from './archived-params.js'

/** Nombre y una segunda línea más chica, para la primera columna de cada tabla. */
function TwoLines({ title, subtitle }) {
  return (
    <div>
      <Text size="sm" fw={600}>
        {title}
      </Text>
      {subtitle && (
        <Text size="xs" c="dimmed">
          {subtitle}
        </Text>
      )}
    </div>
  )
}

/**
 * Configuración de cada sección. Son datos, como el menú (ver dashboard-nav.js):
 * sumar otro recurso con baja lógica es agregar un objeto acá.
 * `adminOnly`: el listado de agencias responde 403 a los demás roles.
 */
const SECTIONS = [
  {
    resource: 'properties',
    title: 'Propiedades',
    icon: IconBuildingEstate,
    emptyText: 'No hay propiedades archivadas. Se archivan desde la edición de cada una.',
    countWords: ['archivada', 'archivadas'],
    list: listProperties,
    restore: restoreProperty,
    nameOf: (p) => p.address,
    columns: [
      { label: 'Propiedad', render: (p) => <TwoLines title={p.address} subtitle={formatPropertyPlace(p)} /> },
      { label: 'Tipo', render: (p) => <RowBadge color="gray">{PROPERTY_TYPE_LABEL[p.type] ?? p.type}</RowBadge> },
    ],
    linkAfterRestore: (p) => ({ to: `/dashboard/propiedades/${p.id}/editar`, label: 'Editar' }),
    allPath: '/dashboard/propiedades?active=false',
  },
  {
    resource: 'agencies',
    title: 'Agencias',
    icon: IconBuildingSkyscraper,
    emptyText: 'No hay agencias dadas de baja.',
    adminOnly: true,
    list: listAgencies,
    restore: restoreAgency,
    nameOf: (a) => a.publicName,
    columns: [
      { label: 'Agencia', render: (a) => <TwoLines title={a.publicName} subtitle={a.cuit && formatCuit(a.cuit)} /> },
      {
        label: 'Verificación',
        render: (a) => (
          <RowBadge color={AGENCY_STATUS_COLOR[a.status]}>{AGENCY_STATUS_SHORT_LABEL[a.status] ?? a.status}</RowBadge>
        ),
      },
    ],
    linkAfterRestore: (a) => ({ to: `/dashboard/agencias/${a.id}/editar`, label: 'Editar' }),
    allPath: '/dashboard/agencias?active=false',
  },
  {
    resource: 'users',
    title: 'Usuarios',
    icon: IconUsers,
    emptyText: 'No hay usuarios dados de baja.',
    list: listUsers,
    restore: restoreUser,
    nameOf: (u) => u.name,
    columns: [
      { label: 'Usuario', render: (u) => <TwoLines title={u.name} subtitle={u.email} /> },
      { label: 'Rol', render: (u) => <RowBadge color={USER_ROL_COLOR[u.rol]}>{USER_ROL_LABEL[u.rol] ?? u.rol}</RowBadge> },
    ],
    linkAfterRestore: (u) => ({ to: `/dashboard/usuarios/${u.id}/editar`, label: 'Editar' }),
    allPath: '/dashboard/usuarios?active=false',
  },
]

const ALL = 'all'

/**
 * Cuántos hay dados de baja en cada sección, para el selector. Pide la primera
 * página con la misma clave que la tabla de cada sección: es un solo pedido.
 * `null` mientras carga o si falló.
 */
function useArchivedCounts(sections) {
  const results = useQueries({
    queries: sections.map((section) => {
      const params = archivedParams(0)
      return {
        queryKey: queryKeys[section.resource].list(params),
        queryFn: ({ signal }) => section.list(params, { signal }),
      }
    }),
  })
  return Object.fromEntries(
    sections.map((section, index) => [section.resource, results[index].data?.totalElements ?? null]),
  )
}

/** Una opción del selector: el nombre y, al lado, cuántos hay. */
function OptionLabel({ label, count }) {
  return (
    <Group gap={6} wrap="nowrap" justify="center">
      <span>{label}</span>
      {count != null && (
        <Text component="span" size="xs" c="dimmed" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </Text>
      )}
    </Group>
  )
}

/**
 * `/dashboard/archivados`: todo lo dado de baja en un solo lugar, listo para
 * restaurar. Para AGENCY y AGENT el backend devuelve solo lo de su inmobiliaria.
 *
 * Las secciones se ven abiertas, una debajo de otra; el selector de arriba deja
 * mirar una sola. Las que no tienen nada se achican a una línea.
 */
export default function ArchiveList() {
  const { isAdmin } = useAuth()
  const sections = SECTIONS.filter((section) => isAdmin || !section.adminOnly)
  const counts = useArchivedCounts(sections)
  const [view, setView] = useState(ALL)

  const known = sections.every((section) => counts[section.resource] != null)
  const grandTotal = known ? sections.reduce((sum, section) => sum + counts[section.resource], 0) : null
  // Nada archivado en ninguna sección: un solo aviso en vez de tres vacíos.
  const nothingArchived = grandTotal === 0

  return (
    <Container size="xl" py="xl">
      <Box mb="lg">
        <Title order={1} size="h2">
          Archivados
        </Title>
        <Text c="dimmed" maw={680}>
          Lo que se dio de baja en {isAdmin ? 'propiedades, agencias y usuarios' : 'propiedades y usuarios'}. Al
          restaurarlo vuelve a su listado como estaba.
        </Text>
      </Box>

      {nothingArchived ? (
        <Card variant="empty" radius="lg" padding="xl">
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon variant="light" color="gray" size={56} radius="xl">
              <IconArchive size={28} />
            </ThemeIcon>
            <Text fw={600}>No hay nada archivado</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Lo que se dé de baja desde cada listado aparece acá, listo para restaurar.
            </Text>
          </Stack>
        </Card>
      ) : (
        <>
          <SegmentedControl
            mb="xl"
            value={view}
            onChange={setView}
            aria-label="Qué archivados ver"
            data={[
              { value: ALL, label: <OptionLabel label="Todo" count={grandTotal} /> },
              ...sections.map((section) => ({
                value: section.resource,
                label: <OptionLabel label={section.title} count={counts[section.resource]} />,
              })),
            ]}
          />

          {/* Las secciones quedan montadas aunque estén ocultas: cada una guarda
              su página y no vuelve a pedir nada al cambiar de vista. */}
          <Stack gap={40}>
            {sections.map((section) => (
              <Box key={section.resource} hidden={view !== ALL && view !== section.resource}>
                {/* `{...section}` pasa cada campo del objeto como una prop:
                    resource={section.resource}, title={section.title}, etc. */}
                <ArchivedSection {...section} />
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Container>
  )
}
