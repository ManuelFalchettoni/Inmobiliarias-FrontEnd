import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Container,
  Grid,
  Group,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertTriangle,
  IconAt,
  IconBuildingSkyscraper,
  IconChevronRight,
  IconCircleCheck,
  IconDeviceFloppy,
  IconLock,
  IconMapPin,
  IconWorld,
} from '@tabler/icons-react'

import { ApiError } from '../../../services/api.js'
import {
  AGENCY_LIMITS,
  AGENCY_STATUS_OPTIONS,
  AGENCY_UNIQUE_FIELDS,
  createAgency,
  formatCuit,
  normalizePhone,
  toAgencyRequest,
} from '../../../services/agencies.js'
import AgencySummary from './AgencySummary.jsx'
import { clearDraft, defaultValues, loadDraft, saveDraft, validation } from './agency-form.js'

const DRAFT_DEBOUNCE_MS = 800

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card withBorder radius="lg" padding="xl" shadow="xs">
      <Group gap="sm" mb="lg" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" size={40} radius="md">
          <Icon size={22} />
        </ThemeIcon>
        <div>
          <Title order={2} size="h4">
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

/**
 * Si el 409 menciona un campo único, se marca ese input además de mostrar el
 * aviso general; así el usuario ve dónde está el dato repetido.
 */
function conflictFieldErrors(message) {
  const normalized = String(message ?? '').toLowerCase()
  const field = AGENCY_UNIQUE_FIELDS.find((name) => normalized.includes(name.toLowerCase()))
  return field ? { [field]: 'Este valor ya está registrado en otra agencia.' } : {}
}

export default function AgencyForm() {
  const [status, setStatus] = useState({ state: 'idle' })
  const [draftSavedAt, setDraftSavedAt] = useState(null)

  const draftTimer = useRef(null)
  const abortRef = useRef(null)

  const form = useForm({
    // Modo no controlado: tipear actualiza la referencia interna sin re-renderizar
    // la página. Solo se vuelve a renderizar quien se suscribe (AgencySummary).
    mode: 'uncontrolled',
    initialValues: loadDraft(),
    validateInputOnBlur: true,
    validate: validation,
    onValuesChange: (values) => {
      clearTimeout(draftTimer.current)
      draftTimer.current = setTimeout(() => {
        if (saveDraft(values)) setDraftSavedAt(new Date())
      }, DRAFT_DEBOUNCE_MS)
    },
  })

  useEffect(
    () => () => {
      clearTimeout(draftTimer.current)
      abortRef.current?.abort()
    },
    [],
  )

  /**
   * `scroll` queda en false cuando el error viene de la API: ahí la pantalla se
   * lleva arriba para mostrar el aviso, y mover el foco además desplazaría la
   * página en sentido contrario.
   */
  const focusFirstError = (path, { scroll = true } = {}) => {
    const node = form.getInputNode(path)
    if (scroll) node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.focus({ preventScroll: true })
  }

  const handleSubmit = async (values) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus({ state: 'submitting' })
    clearTimeout(draftTimer.current)

    try {
      const agency = await createAgency(toAgencyRequest(values), { signal: controller.signal })

      clearDraft()
      setDraftSavedAt(null)
      form.setInitialValues(defaultValues)
      form.reset()
      setStatus({ state: 'created', agency })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (controller.signal.aborted) return

      if (error instanceof ApiError) {
        const fieldErrors = error.hasFieldErrors
          ? error.fieldErrors
          : error.isConflict
            ? conflictFieldErrors(error.message)
            : {}

        if (Object.keys(fieldErrors).length > 0) {
          form.setErrors(fieldErrors)
          focusFirstError(Object.keys(fieldErrors)[0], { scroll: false })
        }
        setStatus({ state: 'error', message: error.message })
      } else {
        setStatus({ state: 'error', message: 'Ocurrió un error inesperado al crear la agencia.' })
      }

      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmitFail = (errors) => {
    const [firstPath] = Object.keys(errors)
    if (firstPath) focusFirstError(firstPath)
  }

  const handleSaveDraft = () => {
    clearTimeout(draftTimer.current)
    setDraftSavedAt(saveDraft(form.getValues()) ? new Date() : null)
  }

  const handleCancel = () => {
    clearTimeout(draftTimer.current)
    clearDraft()
    form.setInitialValues(defaultValues)
    form.reset()
    setDraftSavedAt(null)
    setStatus({ state: 'idle' })
  }

  /** Normaliza el valor al salir del campo; en modo no controlado esto remonta el input. */
  const normalizeOnBlur = (path, normalize) => (event) => {
    form.setFieldValue(path, normalize(event.currentTarget.value))
  }

  const isSubmitting = status.state === 'submitting'

  // `form.onSubmit` se arma dentro del evento: si se llamara en el render, el
  // handler leería los refs durante el renderizado.
  const onSubmit = (event) => form.onSubmit(handleSubmit, handleSubmitFail)(event)

  return (
    <form onSubmit={onSubmit} noValidate>
      <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="xl" py="xl">
          <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
            <Anchor component={Link} to="/dashboard/configuracion" size="xs" c="dimmed" tt="uppercase" fw={600}>
              Configuración
            </Anchor>
            <Anchor component={Link} to="/dashboard/agencias" size="xs" c="dimmed" tt="uppercase" fw={600}>
              Agencias
            </Anchor>
            <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
              Nueva agencia
            </Text>
          </Breadcrumbs>

          <Title order={1} size="h2" mb={4}>
            Alta de nueva agencia inmobiliaria
          </Title>
          <Text c="dimmed" maw={820}>
            Registre la entidad, sus datos de contacto y las credenciales de acceso. El alta queda
            pendiente de verificación hasta que un administrador la apruebe.
          </Text>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        {status.state === 'created' && (
          <Alert
            color="teal"
            icon={<IconCircleCheck />}
            title="Agencia creada"
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            <Text size="sm">
              <b>{status.agency?.publicName ?? 'La agencia'}</b> se registró correctamente
              {status.agency?.id != null && ` con el identificador #${status.agency.id}`}. Estado
              actual: <b>{status.agency?.status}</b>.
            </Text>
            <Anchor component={Link} to="/dashboard/agencias" size="sm" fw={500}>
              Ver el listado de agencias
            </Anchor>
          </Alert>
        )}

        {status.state === 'error' && (
          <Alert
            color="red"
            icon={<IconAlertTriangle />}
            title="No se pudo crear la agencia"
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            {status.message}
          </Alert>
        )}

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="xl">
              <SectionCard
                icon={IconBuildingSkyscraper}
                title="Identidad de la agencia"
                description="Datos registrales y nombre con el que la agencia se muestra al público."
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="CUIT"
                    placeholder="30-71234567-1"
                    description="11 dígitos; se valida el dígito verificador"
                    withAsterisk
                    inputMode="numeric"
                    maxLength={AGENCY_LIMITS.cuit.max}
                    key={form.key('cuit')}
                    {...form.getInputProps('cuit')}
                    onBlur={normalizeOnBlur('cuit', formatCuit)}
                  />
                  <Select
                    label="Estado de la agencia"
                    description="Un alta nueva debería quedar pendiente"
                    data={AGENCY_STATUS_OPTIONS}
                    allowDeselect={false}
                    withAsterisk
                    key={form.key('status')}
                    {...form.getInputProps('status')}
                  />
                  <TextInput
                    label="Razón social"
                    placeholder="Habitat Prime S.R.L."
                    description={`Entre ${AGENCY_LIMITS.companyName.min} y ${AGENCY_LIMITS.companyName.max} caracteres`}
                    withAsterisk
                    maxLength={AGENCY_LIMITS.companyName.max}
                    key={form.key('companyName')}
                    {...form.getInputProps('companyName')}
                  />
                  <TextInput
                    label="Nombre comercial"
                    placeholder="Habitat Prime"
                    description={`Entre ${AGENCY_LIMITS.publicName.min} y ${AGENCY_LIMITS.publicName.max} caracteres`}
                    withAsterisk
                    maxLength={AGENCY_LIMITS.publicName.max}
                    key={form.key('publicName')}
                    {...form.getInputProps('publicName')}
                  />
                </SimpleGrid>
              </SectionCard>

              <SectionCard
                icon={IconMapPin}
                title="Contacto y domicilio"
                description="Canales por los que la agencia recibe consultas y su dirección comercial."
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Email corporativo"
                    placeholder="contacto@habitatprime.com.ar"
                    type="email"
                    autoComplete="email"
                    leftSection={<IconAt size={16} />}
                    withAsterisk
                    maxLength={AGENCY_LIMITS.email.max}
                    key={form.key('email')}
                    {...form.getInputProps('email')}
                  />
                  <TextInput
                    label="Teléfono"
                    placeholder="+5491112345678"
                    description="Se guarda compacto, hasta 15 caracteres"
                    type="tel"
                    autoComplete="tel"
                    withAsterisk
                    key={form.key('phoneNumber')}
                    {...form.getInputProps('phoneNumber')}
                    onBlur={normalizeOnBlur('phoneNumber', normalizePhone)}
                  />
                  <TextInput
                    label="Dirección"
                    placeholder="Av. Colón 1234, Córdoba"
                    description={`Entre ${AGENCY_LIMITS.address.min} y ${AGENCY_LIMITS.address.max} caracteres`}
                    withAsterisk
                    maxLength={AGENCY_LIMITS.address.max}
                    style={{ gridColumn: '1 / -1' }}
                    key={form.key('address')}
                    {...form.getInputProps('address')}
                  />
                </SimpleGrid>
              </SectionCard>

              <SectionCard
                icon={IconWorld}
                title="Presencia online"
                description="Opcional. Se muestra en la ficha pública de la agencia."
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Sitio web"
                    placeholder="habitatprime.com.ar"
                    description="Si omite el protocolo se guarda con https://"
                    maxLength={AGENCY_LIMITS.webURL.max}
                    key={form.key('webURL')}
                    {...form.getInputProps('webURL')}
                  />
                  <TextInput
                    label="Redes sociales"
                    placeholder="instagram.com/habitatprime"
                    maxLength={AGENCY_LIMITS.socials.max}
                    key={form.key('socials')}
                    {...form.getInputProps('socials')}
                  />
                </SimpleGrid>
              </SectionCard>

              <SectionCard
                icon={IconLock}
                title="Credenciales de acceso"
                description="Con estos datos la agencia inicia sesión. No se guardan en el borrador local."
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <PasswordInput
                    label="Contraseña"
                    placeholder="Entre 8 y 20 caracteres"
                    autoComplete="new-password"
                    withAsterisk
                    maxLength={AGENCY_LIMITS.password.max}
                    key={form.key('password')}
                    {...form.getInputProps('password')}
                  />
                  <PasswordInput
                    label="Repetir contraseña"
                    placeholder="Vuelva a escribirla"
                    autoComplete="new-password"
                    withAsterisk
                    maxLength={AGENCY_LIMITS.password.max}
                    key={form.key('confirmPassword')}
                    {...form.getInputProps('confirmPassword')}
                  />
                </SimpleGrid>

                <Checkbox
                  mt="lg"
                  label="Acepto las condiciones del servicio y el tratamiento de los datos de la agencia"
                  key={form.key('acceptTerms')}
                  {...form.getInputProps('acceptTerms', { type: 'checkbox' })}
                />
              </SectionCard>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <AgencySummary form={form} />
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
          <Group justify="space-between" gap="sm" wrap="nowrap">
            <Text size="xs" c="dimmed" visibleFrom="md">
              {draftSavedAt
                ? `Borrador guardado a las ${draftSavedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}. La contraseña nunca se almacena.`
                : 'El borrador se guarda solo en este navegador.'}
            </Text>
            <Group gap="sm" ml="auto" wrap="nowrap">
              <Button variant="subtle" color="gray" onClick={handleCancel} disabled={isSubmitting}>
                Descartar
              </Button>
              <Button
                variant="default"
                leftSection={<IconDeviceFloppy size={18} />}
                onClick={handleSaveDraft}
                disabled={isSubmitting}
              >
                Guardar borrador
              </Button>
              <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={isSubmitting}>
                Crear agencia
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>
    </form>
  )
}
