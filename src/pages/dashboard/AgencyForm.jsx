import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Chip,
  Container,
  FileInput,
  Grid,
  Group,
  NumberInput,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { hasLength, isEmail, isInRange, isNotEmpty, matches, useForm } from '@mantine/form'
import { randomId } from '@mantine/hooks'
import {
  IconAward,
  IconBuildingCommunity,
  IconBuildingSkyscraper,
  IconChevronRight,
  IconCircleCheck,
  IconDeviceFloppy,
  IconEye,
  IconLock,
  IconMapPin,
  IconPhoto,
  IconPlus,
  IconShare,
  IconTrash,
} from '@tabler/icons-react'

const DRAFT_KEY = 'habitatpro:agency-draft'
const PORTAL_DOMAIN = '.habitatpro.es'

const countries = ['España', 'Portugal', 'Andorra']
const portals = ['Idealista', 'Fotocasa', 'Habitaclia', 'pisos.com', 'Kyero']

const emptyBranch = () => ({ key: randomId(), name: '', city: '', manager: '', phone: '' })

const defaultValues = {
  legalName: '',
  tradeName: '',
  tagline: '',
  cif: '',
  subdomain: '',
  email: '',
  phone: '',
  logo: null,
  fiscal: {
    address: '',
    postalCode: '',
    city: '',
    province: '',
    country: 'España',
    iban: '',
  },
  branches: [],
  mls: {
    enabled: true,
    mlsId: '',
    sharedCommission: 50,
    exclusivityDays: 90,
    portals: ['Idealista', 'Fotocasa'],
    currency: 'EUR',
  },
  acceptTerms: false,
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY))
    return draft ? { ...defaultValues, ...draft, logo: null } : defaultValues
  } catch {
    return defaultValues
  }
}

function getInitials(name) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
  return initials || 'AG'
}

function getProgress(values) {
  const required = [
    values.legalName,
    values.tradeName,
    values.cif,
    values.subdomain,
    values.email,
    values.phone,
    values.fiscal.address,
    values.fiscal.postalCode,
    values.fiscal.city,
    values.fiscal.province,
    values.fiscal.country,
    values.fiscal.iban,
    values.acceptTerms,
  ]
  if (values.mls.enabled) required.push(values.mls.mlsId)

  const filled = required.filter((value) => (typeof value === 'string' ? value.trim() : value))
  return Math.round((filled.length / required.length) * 100)
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card withBorder radius="lg" padding="xl" shadow="xs">
      <Group gap="sm" mb="lg" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" size={40} radius="md">
          <Icon size={22} />
        </ThemeIcon>
        <div>
          <Title order={3} size="h4">
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </div>
      </Group>
      {children}
    </Card>
  )
}

function SummaryRow({ label, children }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" truncate>
        {children}
      </Text>
    </Group>
  )
}

function AgencySummary({ values, logoUrl, progress }) {
  const location = [values.fiscal.city, values.fiscal.country].filter(Boolean).join(', ')
  const isReady = progress === 100

  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" pos="sticky" top={88}>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconEye size={20} color="var(--mantine-primary-color-filled)" />
          <Text fw={600}>Resumen de la Agencia</Text>
        </Group>
        <Badge variant="light" size="sm">
          En vivo
        </Badge>
      </Group>

      <Paper withBorder radius="md" p="sm" mb="md" style={{ borderTop: '3px solid var(--mantine-primary-color-filled)' }}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Avatar src={logoUrl} color="dark" variant="filled" radius="md">
              {getInitials(values.tradeName)}
            </Avatar>
            <Box miw={0}>
              <Text fw={600} truncate>
                {values.tradeName || 'Nombre comercial'}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {values.tagline || 'Eslogan de la agencia'}
              </Text>
            </Box>
          </Group>
          <Badge color={isReady ? 'green' : 'gray'} variant="light">
            {isReady ? 'Lista' : 'Borrador'}
          </Badge>
        </Group>
      </Paper>

      <Stack gap="xs" mb="lg">
        <SummaryRow label="Portal web:">
          <Text span ff="monospace" size="sm" c="var(--mantine-primary-color-filled)">
            {(values.subdomain || 'subdominio') + PORTAL_DOMAIN}
          </Text>
        </SummaryRow>
        <SummaryRow label="Ubicación:">{location || '—'}</SummaryRow>
        <SummaryRow label="CIF:">{values.cif.toUpperCase() || '—'}</SummaryRow>
        <SummaryRow label="Delegaciones:">{values.branches.length}</SummaryRow>
        <SummaryRow label="MLS:">{values.mls.enabled ? 'Activo' : 'Desactivado'}</SummaryRow>
      </Stack>

      <Group justify="space-between" mb={6}>
        <Text size="sm" fw={600}>
          Progreso del registro
        </Text>
        <Text size="sm" fw={600} c="var(--mantine-primary-color-filled)">
          {progress}%
        </Text>
      </Group>
      <Progress value={progress} radius="xl" size="md" />
    </Card>
  )
}

export default function AgencyForm() {
  const [initialValues] = useState(loadDraft)
  const [logoUrl, setLogoUrl] = useState(null)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [createdAgency, setCreatedAgency] = useState(null)

  const form = useForm({
    initialValues,
    validateInputOnBlur: true,
    validate: {
      legalName: isNotEmpty('Indique la razón social'),
      tradeName: isNotEmpty('Indique el nombre comercial'),
      cif: matches(/^[ABCDEFGHJNPQRSUVW]-?\d{7}[0-9A-J]$/i, 'CIF no válido (ej. B-88492019)'),
      subdomain: matches(
        /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/,
        'Use entre 3 y 40 caracteres: minúsculas, números y guiones',
      ),
      email: isEmail('Email no válido'),
      phone: matches(/^\+?[\d\s]{9,15}$/, 'Teléfono no válido'),
      fiscal: {
        address: isNotEmpty('Indique la dirección fiscal'),
        postalCode: matches(/^\d{5}$/, 'El código postal debe tener 5 dígitos'),
        city: isNotEmpty('Indique la ciudad'),
        province: isNotEmpty('Indique la provincia'),
        country: isNotEmpty('Seleccione un país'),
        iban: (value) =>
          /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value.replace(/\s/g, '').toUpperCase())
            ? null
            : 'IBAN no válido',
      },
      branches: {
        name: hasLength({ min: 2 }, 'Indique el nombre de la delegación'),
        city: isNotEmpty('Indique la ciudad'),
      },
      mls: {
        mlsId: (value, values) =>
          values.mls.enabled && !value.trim() ? 'Indique el código de asociación MLS' : null,
        sharedCommission: isInRange({ min: 0, max: 100 }, 'Debe estar entre 0 y 100'),
        exclusivityDays: isInRange({ min: 0, max: 365 }, 'Debe estar entre 0 y 365 días'),
      },
      acceptTerms: (value) => (value ? null : 'Debe aceptar las condiciones del servicio'),
    },
  })

  useEffect(() => () => logoUrl && URL.revokeObjectURL(logoUrl), [logoUrl])

  const progress = getProgress(form.values)

  const handleLogoChange = (file) => {
    form.setFieldValue('logo', file)
    setLogoUrl(file ? URL.createObjectURL(file) : null)
  }

  const saveDraft = () => {
    try {
      // eslint-disable-next-line no-unused-vars
      const { logo, ...serializable } = form.values
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializable))
      setDraftSavedAt(new Date())
    } catch {
      setDraftSavedAt(null)
    }
  }

  const cancel = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Ignorar: el almacenamiento local puede no estar disponible
    }
    form.setValues(defaultValues)
    form.resetDirty(defaultValues)
    form.clearErrors()
    handleLogoChange(null)
    setDraftSavedAt(null)
    setCreatedAgency(null)
  }

  const handleSubmit = (values) => {
    // TODO: enviar a la API cuando esté disponible el endpoint de alta de agencias
    const payload = {
      ...values,
      cif: values.cif.toUpperCase(),
      fiscal: { ...values.fiscal, iban: values.fiscal.iban.replace(/\s/g, '').toUpperCase() },
      // eslint-disable-next-line no-unused-vars
      branches: values.branches.map(({ key, ...branch }) => branch),
    }
    console.info('Alta de agencia', payload)
    setCreatedAgency(values.tradeName)
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Ignorar: el almacenamiento local puede no estar disponible
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleErrors = () => {
    setTimeout(() => {
      const firstError = document.querySelector('[data-error]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      firstError?.focus({ preventScroll: true })
    })
  }

  const branchFields = form.values.branches.map((branch, index) => (
    <Paper key={branch.key} withBorder radius="md" p="md">
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={600}>
          Delegación {index + 1}
        </Text>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label={`Eliminar delegación ${index + 1}`}
          onClick={() => form.removeListItem('branches', index)}
        >
          <IconTrash size={18} />
        </ActionIcon>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="Nombre"
          placeholder="Oficina Salamanca"
          withAsterisk
          {...form.getInputProps(`branches.${index}.name`)}
        />
        <TextInput
          label="Ciudad"
          placeholder="Madrid"
          withAsterisk
          {...form.getInputProps(`branches.${index}.city`)}
        />
        <TextInput
          label="Responsable"
          placeholder="Laura Gómez"
          {...form.getInputProps(`branches.${index}.manager`)}
        />
        <TextInput
          label="Teléfono"
          placeholder="+34 910 000 000"
          {...form.getInputProps(`branches.${index}.phone`)}
        />
      </SimpleGrid>
    </Paper>
  ))

  return (
    <form onSubmit={form.onSubmit(handleSubmit, handleErrors)} noValidate>
      <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="xl" py="xl">
          <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
            <Anchor component={Link} to="/dashboard/configuracion" size="xs" c="dimmed" tt="uppercase" fw={600}>
              Configuración
            </Anchor>
            <Anchor component={Link} to="/dashboard/agencias" size="xs" c="dimmed" tt="uppercase" fw={600}>
              Gestión de agencias
            </Anchor>
            <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
              Nueva agencia inmobiliaria
            </Text>
          </Breadcrumbs>

          <Title order={1} size="h2" mb={4}>
            Alta y Registro de Nueva Agencia Inmobiliaria
          </Title>
          <Text c="dimmed" maw={820} mb="lg">
            Configure la entidad corporativa, datos fiscales, delegaciones y parámetros MLS para
            habilitar la operativa de sus brokers y agentes.
          </Text>

          <Group gap="sm">
            <Button variant="default" leftSection={<IconDeviceFloppy size={18} />} onClick={saveDraft}>
              Guardar borrador
            </Button>
            <Button variant="subtle" color="gray" onClick={cancel}>
              Cancelar
            </Button>
            <Button type="submit" leftSection={<IconCircleCheck size={18} />}>
              Completar alta y crear agencia
            </Button>
            {draftSavedAt && (
              <Text size="sm" c="dimmed">
                Borrador guardado a las{' '}
                {draftSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </Group>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        {createdAgency && (
          <Alert
            color="green"
            icon={<IconCircleCheck />}
            title="Agencia creada"
            mb="lg"
            withCloseButton
            onClose={() => setCreatedAgency(null)}
          >
            {createdAgency} se ha registrado correctamente.
          </Alert>
        )}

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="xl">
              <SectionCard
                icon={IconBuildingSkyscraper}
                title="Entidad corporativa"
                description="Identidad legal y de marca con la que operará la agencia."
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Razón social"
                    placeholder="Habitat Prime S.L."
                    withAsterisk
                    {...form.getInputProps('legalName')}
                  />
                  <TextInput
                    label="Nombre comercial"
                    placeholder="Habitat Prime"
                    withAsterisk
                    {...form.getInputProps('tradeName')}
                  />
                  <TextInput
                    label="Eslogan o segmento"
                    placeholder="Luxury Real Estate"
                    {...form.getInputProps('tagline')}
                  />
                  <TextInput
                    label="CIF"
                    placeholder="B-88492019"
                    withAsterisk
                    {...form.getInputProps('cif')}
                  />
                  <TextInput
                    label="Portal web"
                    description="Subdominio público de la agencia"
                    placeholder="habitatprime"
                    withAsterisk
                    rightSection={
                      <Text size="sm" c="dimmed" pr="sm">
                        {PORTAL_DOMAIN}
                      </Text>
                    }
                    rightSectionWidth={120}
                    {...form.getInputProps('subdomain')}
                    onChange={(event) =>
                      form.setFieldValue('subdomain', event.currentTarget.value.toLowerCase())
                    }
                  />
                  <FileInput
                    label="Logotipo"
                    description="PNG o SVG, fondo transparente"
                    placeholder="Subir logotipo"
                    accept="image/png,image/svg+xml,image/jpeg"
                    leftSection={<IconPhoto size={16} />}
                    clearable
                    value={form.values.logo}
                    onChange={handleLogoChange}
                  />
                  <TextInput
                    label="Email corporativo"
                    placeholder="contacto@habitatprime.es"
                    type="email"
                    withAsterisk
                    {...form.getInputProps('email')}
                  />
                  <TextInput
                    label="Teléfono"
                    placeholder="+34 910 000 000"
                    type="tel"
                    withAsterisk
                    {...form.getInputProps('phone')}
                  />
                </SimpleGrid>
              </SectionCard>

              <SectionCard
                icon={IconMapPin}
                title="Datos fiscales y delegaciones"
                description="Domicilio fiscal, cuenta de liquidación y oficinas de la agencia."
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Dirección fiscal"
                    placeholder="Calle de Serrano, 45"
                    withAsterisk
                    style={{ gridColumn: '1 / -1' }}
                    {...form.getInputProps('fiscal.address')}
                  />
                  <TextInput
                    label="Código postal"
                    placeholder="28001"
                    withAsterisk
                    maxLength={5}
                    {...form.getInputProps('fiscal.postalCode')}
                  />
                  <TextInput
                    label="Ciudad"
                    placeholder="Madrid"
                    withAsterisk
                    {...form.getInputProps('fiscal.city')}
                  />
                  <TextInput
                    label="Provincia"
                    placeholder="Madrid"
                    withAsterisk
                    {...form.getInputProps('fiscal.province')}
                  />
                  <Select
                    label="País"
                    data={countries}
                    withAsterisk
                    allowDeselect={false}
                    {...form.getInputProps('fiscal.country')}
                  />
                  <TextInput
                    label="IBAN de liquidación"
                    placeholder="ES91 2100 0418 4502 0005 1332"
                    withAsterisk
                    style={{ gridColumn: '1 / -1' }}
                    {...form.getInputProps('fiscal.iban')}
                  />
                </SimpleGrid>

                <Group justify="space-between" mt="xl" mb="sm">
                  <div>
                    <Text fw={600}>Delegaciones</Text>
                    <Text size="sm" c="dimmed">
                      Oficinas adicionales desde las que operan sus agentes.
                    </Text>
                  </div>
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => form.insertListItem('branches', emptyBranch())}
                  >
                    Añadir delegación
                  </Button>
                </Group>

                {branchFields.length > 0 ? (
                  <Stack gap="sm">{branchFields}</Stack>
                ) : (
                  <Paper withBorder radius="md" p="lg" bg="gray.0" style={{ borderStyle: 'dashed' }}>
                    <Group gap="sm" justify="center">
                      <IconBuildingCommunity size={20} color="var(--mantine-color-gray-6)" />
                      <Text size="sm" c="dimmed">
                        Sin delegaciones. La sede fiscal se usará como oficina principal.
                      </Text>
                    </Group>
                  </Paper>
                )}
              </SectionCard>

              <SectionCard
                icon={IconShare}
                title="Parámetros MLS"
                description="Colaboración con otras agencias y sindicación en portales."
              >
                <Switch
                  label="Participar en el MLS compartido"
                  description="Permite compartir inmuebles y comisiones con agencias colaboradoras."
                  mb="lg"
                  {...form.getInputProps('mls.enabled', { type: 'checkbox' })}
                />

                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Código de asociación MLS"
                    placeholder="MLS-MAD-00421"
                    withAsterisk={form.values.mls.enabled}
                    disabled={!form.values.mls.enabled}
                    {...form.getInputProps('mls.mlsId')}
                  />
                  <NumberInput
                    label="Comisión compartida por defecto"
                    suffix="%"
                    min={0}
                    max={100}
                    disabled={!form.values.mls.enabled}
                    {...form.getInputProps('mls.sharedCommission')}
                  />
                  <NumberInput
                    label="Exclusividad mínima"
                    suffix=" días"
                    min={0}
                    max={365}
                    {...form.getInputProps('mls.exclusivityDays')}
                  />
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>
                      Moneda de publicación
                    </Text>
                    <SegmentedControl
                      data={[
                        { label: '€ EUR', value: 'EUR' },
                        { label: '$ USD', value: 'USD' },
                      ]}
                      {...form.getInputProps('mls.currency')}
                    />
                  </Stack>
                </SimpleGrid>

                <Text size="sm" fw={500} mt="lg" mb="xs">
                  Portales de sindicación
                </Text>
                <Chip.Group multiple {...form.getInputProps('mls.portals')}>
                  <Group gap="xs">
                    {portals.map((portal) => (
                      <Chip key={portal} value={portal} variant="outline">
                        {portal}
                      </Chip>
                    ))}
                  </Group>
                </Chip.Group>

                <Paper radius="md" p="md" mt="xl" bg="var(--mantine-primary-color-light)">
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon size={44} radius="md">
                        <IconAward size={24} />
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={600}>
                          Plan Habitat Enterprise (prueba 14 días gratis)
                        </Text>
                        <Text size="sm" c="dimmed">
                          Acceso completo a herramientas, portales y CRM de leads.
                        </Text>
                      </div>
                    </Group>
                    <Text size="sm" fw={600} c="var(--mantine-primary-color-filled)" visibleFrom="sm">
                      Sin compromiso
                    </Text>
                  </Group>
                </Paper>

                <Checkbox
                  mt="lg"
                  label="Acepto las condiciones del servicio y el tratamiento de datos de la agencia"
                  {...form.getInputProps('acceptTerms', { type: 'checkbox' })}
                />
              </SectionCard>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <AgencySummary values={form.values} logoUrl={logoUrl} progress={progress} />
          </Grid.Col>
        </Grid>
      </Container>

      <Box
        pos="sticky"
        bottom={0}
        bg="white"
        py="sm"
        style={{ borderTop: '1px solid var(--mantine-color-gray-2)', zIndex: 10 }}
      >
        <Container size="xl">
          <Group justify="space-between" gap="sm">
            <Group gap="xs" wrap="nowrap" visibleFrom="md">
              <IconLock size={18} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                Todos los datos se almacenan conforme al <b>RGPD & LOPDGDD</b> con cifrado bancario
                de 256 bits.
              </Text>
            </Group>
            <Group gap="sm" ml="auto">
              <Button variant="subtle" color="gray" onClick={saveDraft} visibleFrom="sm">
                Guardar borrador para continuar luego
              </Button>
              <Button type="submit" leftSection={<IconBuildingCommunity size={18} />}>
                Confirmar y crear agencia inmobiliaria
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>
    </form>
  )
}
