import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  Select,
  SimpleGrid,
  Skeleton,
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
  IconMapPin,
  IconWorld,
} from '@tabler/icons-react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../../../queries/keys.js'
import { ApiError } from '../../../services/api.js'
import {
  AGENCY_LIMITS,
  AGENCY_STATUS_OPTIONS,
  AGENCY_STATUS_SHORT_LABEL,
  AGENCY_UNIQUE_FIELDS,
  createAgency,
  findAgency,
  formatCuit,
  normalizePhone,
  toAgencyFormValues,
  toAgencyRequest,
  updateAgency,
} from '../../../services/agencies.js'
import AgencySummary from './AgencySummary.jsx'
import {
  clearDraft,
  defaultValues,
  editValidation,
  loadDraft,
  saveDraft,
  validation,
} from './agency-form.js'

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
  // `find` devuelve el primer campo único que aparece en el mensaje del
  // backend ("Email already registered: ..." -> 'email').
  const field = AGENCY_UNIQUE_FIELDS.find((name) => normalized.includes(name.toLowerCase()))
  return field ? { [field]: 'Este valor ya está registrado en otra agencia.' } : {}
}

/**
 * Alta y edición. Con `agency` se edita: no hay borrador local ni casilla de
 * condiciones, y se guarda con un `PUT` que pisa todos los campos.
 */
function AgencyEditor({ agency }) {
  const isEdit = agency != null
  // Acceso a la caché de React Query, para invalidarla después de guardar.
  const queryClient = useQueryClient()
  const [status, setStatus] = useState({ state: 'idle' })
  // Hora del último borrador guardado, para el texto de la barra inferior.
  const [draftSavedAt, setDraftSavedAt] = useState(null)

  // El temporizador del borrador vive en un ref: cambiarlo no redibuja.
  const draftTimer = useRef(null)
  const abortRef = useRef(null)
  // Las reglas se eligen una sola vez: en edición, el CUIT ya guardado no se
  // revisa con el dígito verificador (ver editValidation en agency-form.js).
  // Se usa useState solo para conservar el mismo objeto entre renders.
  const [rules] = useState(() => (isEdit ? editValidation(agency.cuit) : validation))

  const form = useForm({
    // Modo no controlado: tipear actualiza la referencia interna sin re-renderizar
    // la página. Solo se vuelve a renderizar quien se suscribe (AgencySummary).
    mode: 'uncontrolled',
    initialValues: isEdit ? toAgencyFormValues(agency) : loadDraft(),
    validateInputOnBlur: true,
    validate: rules,
    // Borrador automático con "debounce": cada cambio reinicia un temporizador
    // y recién se guarda cuando se deja de escribir por DRAFT_DEBOUNCE_MS.
    // En la edición no hay borrador: los datos ya están en el backend.
    onValuesChange: (values) => {
      if (isEdit) return
      clearTimeout(draftTimer.current)
      draftTimer.current = setTimeout(() => {
        if (saveDraft(values)) setDraftSavedAt(new Date())
      }, DRAFT_DEBOUNCE_MS)
    },
  })

  // Una agencia en `DELETED` igual tiene que mostrar su estado en el Select.
  const statusOptions = AGENCY_STATUS_OPTIONS.some((option) => option.value === agency?.status)
    ? AGENCY_STATUS_OPTIONS
    : isEdit
      ? [...AGENCY_STATUS_OPTIONS, { value: agency.status, label: AGENCY_STATUS_SHORT_LABEL[agency.status] ?? agency.status }]
      : AGENCY_STATUS_OPTIONS

  // Solo limpieza: al salir de la pantalla se cancela el borrador pendiente y
  // el pedido en curso.
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
      if (isEdit) {
        const saved = await updateAgency(agency.id, toAgencyRequest(values), { signal: controller.signal })
        // Marca como viejo todo lo de agencias (listado, detalle, nombres en
        // otras pantallas): React Query lo vuelve a pedir donde se muestre.
        queryClient.invalidateQueries({ queryKey: queryKeys.agencies.all })
        // Lo guardado pasa a ser el nuevo punto de partida del formulario.
        form.setInitialValues(toAgencyFormValues(saved))
        form.resetDirty()
        setStatus({ state: 'saved', agency: saved })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const created = await createAgency(toAgencyRequest(values), { signal: controller.signal })

      // Hay una agencia más: el listado y el total del menú se actualizan.
      queryClient.invalidateQueries({ queryKey: queryKeys.agencies.all })

      // Alta exitosa: se borra el borrador y el formulario vuelve a vacío.
      clearDraft()
      setDraftSavedAt(null)
      form.setInitialValues(defaultValues)
      form.reset()
      setStatus({ state: 'created', agency: created })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (controller.signal.aborted) return

      if (error instanceof ApiError) {
        // 400 con campos -> esos errores; 409 -> el campo repetido; si no, ninguno.
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
        setStatus({ state: 'error', message: 'Ocurrió un error inesperado.' })
      }

      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmitFail = (errors) => {
    const [firstPath] = Object.keys(errors)
    if (firstPath) focusFirstError(firstPath)
  }

  // Botón "Guardar borrador": guarda ya, sin esperar el temporizador.
  const handleSaveDraft = () => {
    clearTimeout(draftTimer.current)
    setDraftSavedAt(saveDraft(form.getValues()) ? new Date() : null)
  }

  // Botón "Descartar": borra el borrador y deja el formulario vacío.
  const handleCancel = () => {
    clearTimeout(draftTimer.current)
    clearDraft()
    form.setInitialValues(defaultValues)
    form.reset()
    setDraftSavedAt(null)
    setStatus({ state: 'idle' })
  }

  /** Normaliza el valor al salir del campo; en modo no controlado esto remonta el input. */
  // Devuelve un manejador de onBlur para un campo: normalizeOnBlur('cuit', formatCuit).
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
              {isEdit ? `Agencia #${agency.id}` : 'Nueva agencia'}
            </Text>
          </Breadcrumbs>

          <Title order={1} size="h2" mb={4}>
            {isEdit ? `Editar ${agency.publicName}` : 'Alta de nueva agencia inmobiliaria'}
          </Title>
          <Text c="dimmed" maw={820}>
            {isEdit
              ? 'Se guardan todos los datos juntos. El CUIT, la razón social, el email, el teléfono y la dirección no pueden repetirse con otra agencia.'
              : 'Registre la entidad y sus datos de contacto. El alta queda pendiente de verificación hasta que un administrador la apruebe. Para entrar al panel, la agencia necesita un usuario con rol Agencia vinculado a ella.'}
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
            <Group gap="md">
              <Anchor component={Link} to="/dashboard/usuarios/nuevo" size="sm" fw={500}>
                Crear el usuario de la agencia
              </Anchor>
              <Anchor component={Link} to="/dashboard/agencias" size="sm" fw={500}>
                Ver el listado de agencias
              </Anchor>
            </Group>
          </Alert>
        )}

        {status.state === 'saved' && (
          <Alert
            color="teal"
            icon={<IconCircleCheck />}
            title="Cambios guardados"
            mb="lg"
            withCloseButton
            onClose={() => setStatus({ state: 'idle' })}
          >
            <Anchor component={Link} to="/dashboard/agencias" size="sm" fw={500}>
              Volver al listado de agencias
            </Anchor>
          </Alert>
        )}

        {status.state === 'error' && (
          <Alert
            color="red"
            icon={<IconAlertTriangle />}
            title={isEdit ? 'No se pudieron guardar los cambios' : 'No se pudo crear la agencia'}
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
                    // `inputMode="numeric"` muestra el teclado numérico en el celular.
                    inputMode="numeric"
                    maxLength={AGENCY_LIMITS.cuit.max}
                    key={form.key('cuit')}
                    {...form.getInputProps('cuit')}
                    // Va después de getInputProps para reemplazar su onBlur: al
                    // salir del campo se le ponen los guiones al CUIT.
                    onBlur={normalizeOnBlur('cuit', formatCuit)}
                  />
                  <Select
                    label="Estado de la agencia"
                    description={isEdit ? 'Circuito de verificación' : 'Un alta nueva debería quedar pendiente'}
                    data={statusOptions}
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

              {/* Las condiciones se aceptan una sola vez, en el alta. */}
              {!isEdit && (
                <Card withBorder radius="lg" padding="lg" shadow="xs">
                  <Checkbox
                    label="Acepto las condiciones del servicio y el tratamiento de los datos de la agencia"
                    key={form.key('acceptTerms')}
                    {...form.getInputProps('acceptTerms', { type: 'checkbox' })}
                  />
                </Card>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            {/* Vista previa en vivo: recibe el `form` y se suscribe a sus campos. */}
            <AgencySummary form={form} rules={rules} isEdit={isEdit} />
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
              {isEdit
                ? 'Los cambios se guardan al confirmar.'
                : draftSavedAt
                  ? `Borrador guardado a las ${draftSavedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}.`
                  : 'El borrador se guarda solo en este navegador.'}
            </Text>
            {/* Botones distintos en alta (borrador) y en edición. */}
            {isEdit ? (
              <Group gap="sm" ml="auto" wrap="nowrap">
                <Button component={Link} to="/dashboard/agencias" variant="subtle" color="gray" disabled={isSubmitting}>
                  Volver al listado
                </Button>
                <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={isSubmitting}>
                  Guardar cambios
                </Button>
              </Group>
            ) : (
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
            )}
          </Group>
        </Container>
      </Box>
    </form>
  )
}

/**
 * Trae la agencia antes de montar el editor, así el formulario nace con sus valores.
 * Es el mismo patrón Loader + Editor del formulario de propiedades.
 */
function AgencyLoader({ id }) {
  const query = useQuery({
    queryKey: queryKeys.agencies.detail(id),
    queryFn: ({ signal }) => findAgency(id, { signal }),
  })

  // Si ya hay datos se usan aunque falle una recarga en segundo plano (ver PropertyLoader).
  const result = query.data
    ? { agency: query.data }
    : query.isError
      ? {
          error:
            query.error instanceof ApiError && query.error.status === 404
              ? `No existe una agencia activa con el identificador #${id}. Si está dada de baja, restáurela desde el listado.`
              : query.error.message,
        }
      : null

  if (result?.agency) return <AgencyEditor agency={result.agency} />

  return (
    <Container size="xl" py="xl">
      {result?.error ? (
        <Alert color="red" icon={<IconAlertTriangle />} title="No se puede editar la agencia">
          {result.error}{' '}
          <Anchor component={Link} to="/dashboard/agencias" size="sm" fw={500}>
            Volver al listado
          </Anchor>
        </Alert>
      ) : (
        <Stack gap="xl">
          <Skeleton height={90} radius="lg" />
          <Skeleton height={260} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </Stack>
      )}
    </Container>
  )
}

/** `/agencias/nueva` y `/agencias/:id/editar`. */
export default function AgencyForm() {
  const { id } = useParams()
  return id ? <AgencyLoader key={id} id={id} /> : <AgencyEditor key="new" />
}
