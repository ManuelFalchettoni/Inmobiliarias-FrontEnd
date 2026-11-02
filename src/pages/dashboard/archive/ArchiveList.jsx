import { useState } from 'react'
import { Accordion, Box, Button, Container, Group, Text, Title } from '@mantine/core'
import { IconBuildingEstate, IconBuildingSkyscraper, IconUsers } from '@tabler/icons-react'

import { useAuth } from '../../../context/auth-context.js'
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

/**
 * `/dashboard/archivados`: todo lo dado de baja en un solo lugar, listo para
 * restaurar. Para AGENCY y AGENT el backend devuelve solo lo de su inmobiliaria.
 */
export default function ArchiveList() {
  const { isAdmin } = useAuth()
  const sections = SECTIONS.filter((section) => isAdmin || !section.adminOnly)
  // Qué cajones están abiertos: arrancan todos cerrados (los contadores de cada
  // barra ya dicen qué hay) y cada uno se abre por separado. Es estado
  // "controlado": el acordeón lo lee de acá y avisa cada cambio con `onChange`,
  // así el botón "Abrir todo" también lo puede tocar.
  const [open, setOpen] = useState([])
  const allOpen = open.length === sections.length

  return (
    <Container size="xl" py="xl">
      <Box mb="xl">
        <Title order={1} size="h2">
          Archivados
        </Title>
        <Text c="dimmed" maw={760}>
          Propiedades{isAdmin ? ', agencias' : ''} y usuarios dados de baja, listos para restaurar. Al
          restaurarlos vuelven a sus listados como estaban.
        </Text>
      </Box>

      <Group justify="flex-end" mb="sm">
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          onClick={() => setOpen(allOpen ? [] : sections.map((section) => section.resource))}
        >
          {allOpen ? 'Cerrar todo' : 'Abrir todo'}
        </Button>
      </Group>

      {/* `multiple`: se pueden tener varios cajones abiertos a la vez (sin él,
          abrir uno cierra el resto). `separated`: cada cajón es una tarjeta. */}
      <Accordion
        multiple
        variant="separated"
        radius="lg"
        chevronPosition="right"
        value={open}
        onChange={setOpen}
        styles={{ item: { backgroundColor: 'var(--mantine-color-body)' } }}
      >
        {/* `{...section}` pasa cada campo del objeto como una prop:
            resource={section.resource}, title={section.title}, etc. */}
        {sections.map((section) => (
          <ArchivedSection key={section.resource} {...section} />
        ))}
      </Accordion>
    </Container>
  )
}
