import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Grid,
  Group,
  List,
  NumberInput,
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
  IconBuildingSkyscraper,
  IconChevronRight,
  IconCircleCheck,
  IconHome,
  IconMapPin,
  IconPhoto,
} from '@tabler/icons-react'

import { ApiError } from '../../../services/api.js'
import { listAgencies } from '../../../services/agencies.js'
import {
  PHOTO_LIMITS,
  PROPERTY_CONDITION_OPTIONS,
  PROPERTY_LIMITS,
  PROPERTY_OCCUPANCY_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  createProperty,
  deletePropertyPhoto,
  findProperty,
  sortPhotos,
  toPropertyFormValues,
  toPropertyRequest,
  updateProperty,
  uploadPropertyPhotos,
} from '../../../services/properties.js'
import PropertyPhotos from './PropertyPhotos.jsx'
import { propertyDefaultValues, propertyValidation } from './property-form.js'

const LIST_PATH = '/dashboard/propiedades'
const editPath = (id) => `${LIST_PATH}/${id}/editar`

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

function PageHeader({ propertyId }) {
  return (
    <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Container size="xl" py="xl">
        <Breadcrumbs separator={<IconChevronRight size={14} />} mb="xs">
          <Anchor component={Link} to={LIST_PATH} size="xs" c="dimmed" tt="uppercase" fw={600}>
            Propiedades
          </Anchor>
          <Text size="xs" c="var(--mantine-primary-color-filled)" tt="uppercase" fw={600}>
            {propertyId ? `Propiedad #${propertyId}` : 'Nueva propiedad'}
          </Text>
        </Breadcrumbs>
        <Title order={1} size="h2" mb={4}>
          {propertyId ? 'Editar propiedad' : 'Publicar propiedad'}
        </Title>
        <Text c="dimmed" maw={820}>
          {propertyId
            ? 'Actualice los datos del inmueble y administre sus fotos. Los cambios se guardan al confirmar.'
            : 'Cargue los datos del inmueble y sus fotos. Primero se crea la propiedad y después se suben las fotos, una por una.'}
        </Text>
      </Container>
    </Box>
  )
}

/**
 * Agencias activas para el Select. El tope de página del backend es 100: si
 * algún día hay más, esto tiene que pasar a un Select con búsqueda remota.
 */
function useAgencyOptions(currentId) {
  const [result, setResult] = useState({ state: 'loading', options: [] })

  useEffect(() => {
    const controller = new AbortController()

    listAgencies({ size: 100, sort: 'publicName,asc', active: true }, { signal: controller.signal })
      .then((page) =>
        setResult({
          state: 'ready',
          options: page.content.map((agency) => ({
            value: String(agency.id),
            label: `${agency.publicName} (#${agency.id})`,
          })),
        }),
      )
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ state: 'error', message: error.message, options: [] })
      })

    return () => controller.abort()
  }, [])

  // Una propiedad cuya agencia ya no está activa igual tiene que mostrar su valor.
  const missing = currentId && !result.options.some((option) => option.value === currentId)
  const options = missing ? [{ value: currentId, label: `Agencia #${currentId}` }, ...result.options] : result.options

  return { ...result, options }
}

function PropertyEditor({ property }) {
  const navigate = useNavigate()
  const location = useLocation()

  // Con `property` se edita; sin ella, el id aparece cuando el alta responde.
  const [createdId, setCreatedId] = useState(null)
  const propertyId = property?.id ?? createdId

  const [photos, setPhotos] = useState(() => sortPhotos(property?.photos))
  const [queue, setQueue] = useState([])
  const [status, setStatus] = useState(() =>
    location.state?.created ? { state: 'created' } : { state: 'idle' },
  )

  const abortRef = useRef(null)
  const queueRef = useRef(queue)

  const initialValues = property ? toPropertyFormValues(property) : propertyDefaultValues
  const agencies = useAgencyOptions(initialValues.idAgency)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues,
    validateInputOnBlur: true,
    validate: propertyValidation,
  })

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  // Al salir se cancela lo que esté en vuelo y se liberan las vistas previas.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      for (const item of queueRef.current) URL.revokeObjectURL(item.preview)
    },
    [],
  )

  const startRequest = () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    return controller.signal
  }

  const addFiles = (files) => {
    // Las URLs se crean fuera del updater: en StrictMode el updater corre dos veces.
    const items = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      error: null,
    }))
    setQueue((current) => [...current, ...items])
  }

  const removeQueued = (key) => {
    const item = queue.find((entry) => entry.key === key)
    if (item) URL.revokeObjectURL(item.preview)
    setQueue((current) => current.filter((entry) => entry.key !== key))
  }

  const patchQueued = (key, changes) =>
    setQueue((current) => current.map((entry) => (entry.key === key ? { ...entry, ...changes } : entry)))

  /**
   * Sube la cola de a una foto por request: el backend guarda cada lote en una
   * transacción, así que un archivo malo haría perder a todos los demás. De a
   * una, lo que falla queda marcado en su tile y el resto se sube igual.
   * Devuelve cuántas fallaron.
   */
  const uploadQueue = async (id, signal) => {
    let failed = 0

    for (const item of queue) {
      if (signal.aborted) break
      patchQueued(item.key, { status: 'uploading', error: null })

      try {
        const [photo] = await uploadPropertyPhotos(id, [item.file], { signal })
        URL.revokeObjectURL(item.preview)
        setQueue((current) => current.filter((entry) => entry.key !== item.key))
        if (photo) setPhotos((current) => [...current, photo])
      } catch (error) {
        if (signal.aborted) break
        failed += 1
        patchQueued(item.key, { status: 'error', error: error.message })
      }
    }

    return failed
  }

  const deletePhoto = async (photo) => {
    await deletePropertyPhoto(propertyId, photo.id)
    setPhotos((current) => current.filter((entry) => entry.id !== photo.id))
  }

  const focusField = (path) => {
    const node = form.getInputNode(path)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.focus({ preventScroll: true })
  }

  const handleSubmit = async (values) => {
    const signal = startRequest()
    const isNew = propertyId == null
    let id = propertyId

    setStatus({ state: 'saving' })

    try {
      const request = toPropertyRequest(values)
      if (isNew) {
        const created = await createProperty(request, { signal })
        id = created.id
        setCreatedId(id)
      } else {
        await updateProperty(id, request, { signal })
      }
    } catch (error) {
      if (signal.aborted) return

      if (error instanceof ApiError && error.hasFieldErrors) {
        form.setErrors(error.fieldErrors)
        focusField(Object.keys(error.fieldErrors)[0])
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      setStatus({
        state: 'error',
        title: isNew ? 'No se pudo publicar la propiedad' : 'No se pudieron guardar los cambios',
        message: error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.',
      })
      return
    }

    if (queue.length > 0) setStatus({ state: 'uploading' })
    const failed = await uploadQueue(id, signal)
    if (signal.aborted) return

    // Alta completa: se pasa a la URL de edición para que recargar no duplique el alta.
    if (isNew && failed === 0) {
      navigate(editPath(id), { replace: true, state: { created: true } })
      return
    }

    setStatus(failed > 0 ? { state: 'partial', failed, isNew, id } : { state: 'saved' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmitFail = (errors) => {
    const [firstPath] = Object.keys(errors)
    if (firstPath) focusField(firstPath)
  }

  const handleUploadNow = async () => {
    const signal = startRequest()
    setStatus({ state: 'uploading' })
    const failed = await uploadQueue(propertyId, signal)
    if (signal.aborted) return
    setStatus(failed > 0 ? { state: 'partial', failed, isNew: false, id: propertyId } : { state: 'photos-saved' })
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit, handleSubmitFail)(event)
  const busy = status.state === 'saving' || status.state === 'uploading'
  const dismiss = () => setStatus({ state: 'idle' })

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader propertyId={propertyId} />

      <Container size="xl" py="xl">
        {status.state === 'created' && (
          <Alert color="teal" icon={<IconCircleCheck />} title="Propiedad publicada" mb="lg" withCloseButton onClose={dismiss}>
            La propiedad #{propertyId} se creó con {photos.length}{' '}
            {photos.length === 1 ? 'foto' : 'fotos'}.{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Ver el listado
            </Anchor>
          </Alert>
        )}
        {status.state === 'saved' && (
          <Alert color="teal" icon={<IconCircleCheck />} title="Cambios guardados" mb="lg" withCloseButton onClose={dismiss} />
        )}
        {status.state === 'photos-saved' && (
          <Alert color="teal" icon={<IconCircleCheck />} title="Fotos subidas" mb="lg" withCloseButton onClose={dismiss} />
        )}
        {status.state === 'partial' && (
          <Alert
            color="orange"
            icon={<IconAlertTriangle />}
            title={status.failed === 1 ? 'Una foto no se pudo subir' : `${status.failed} fotos no se pudieron subir`}
            mb="lg"
            withCloseButton
            onClose={dismiss}
          >
            {status.isNew
              ? `La propiedad se creó con el identificador #${status.id}. `
              : 'Los datos se guardaron. '}
            El motivo figura en cada foto marcada con error: puede quitarla o volver a intentarlo.
          </Alert>
        )}
        {status.state === 'error' && (
          <Alert color="red" icon={<IconAlertTriangle />} title={status.title} mb="lg" withCloseButton onClose={dismiss}>
            {status.message}
          </Alert>
        )}

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="xl">
              <SectionCard
                icon={IconMapPin}
                title="Ubicación"
                description="Dirección exacta del inmueble y la localidad donde se publica."
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Dirección"
                    placeholder="Av. Colón 1234, 5° B"
                    description={`Hasta ${PROPERTY_LIMITS.address.max} caracteres`}
                    withAsterisk
                    maxLength={PROPERTY_LIMITS.address.max}
                    key={form.key('address')}
                    {...form.getInputProps('address')}
                  />
                  <TextInput
                    label="Localidad"
                    placeholder="Córdoba Capital"
                    description={`Hasta ${PROPERTY_LIMITS.location.max} caracteres`}
                    withAsterisk
                    maxLength={PROPERTY_LIMITS.location.max}
                    key={form.key('location')}
                    {...form.getInputProps('location')}
                  />
                </SimpleGrid>
              </SectionCard>

              <SectionCard
                icon={IconHome}
                title="Características"
                description="Tipo de inmueble, estado y superficie."
              >
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Select
                    label="Tipo"
                    placeholder="Elegir"
                    data={PROPERTY_TYPE_OPTIONS}
                    withAsterisk
                    key={form.key('type')}
                    {...form.getInputProps('type')}
                  />
                  <Select
                    label="Condición"
                    placeholder="Elegir"
                    data={PROPERTY_CONDITION_OPTIONS}
                    withAsterisk
                    key={form.key('condition')}
                    {...form.getInputProps('condition')}
                  />
                  <Select
                    label="Ocupación"
                    placeholder="Elegir"
                    data={PROPERTY_OCCUPANCY_OPTIONS}
                    withAsterisk
                    key={form.key('occupancy')}
                    {...form.getInputProps('occupancy')}
                  />
                </SimpleGrid>
                <SimpleGrid cols={{ base: 2, sm: 4 }} mt="md">
                  <NumberInput
                    label="Superficie"
                    placeholder="85"
                    rightSection={<Text size="sm" c="dimmed">m²</Text>}
                    min={PROPERTY_LIMITS.size.min}
                    allowDecimal={false}
                    allowNegative={false}
                    withAsterisk
                    key={form.key('size')}
                    {...form.getInputProps('size')}
                  />
                  <NumberInput
                    label="Ambientes"
                    placeholder="3"
                    min={PROPERTY_LIMITS.rooms.min}
                    allowDecimal={false}
                    allowNegative={false}
                    withAsterisk
                    key={form.key('rooms')}
                    {...form.getInputProps('rooms')}
                  />
                  <NumberInput
                    label="Piso"
                    description="0 = planta baja"
                    min={PROPERTY_LIMITS.floorNumber.min}
                    allowDecimal={false}
                    allowNegative={false}
                    withAsterisk
                    key={form.key('floorNumber')}
                    {...form.getInputProps('floorNumber')}
                  />
                  <NumberInput
                    label="Año de construcción"
                    placeholder="Opcional"
                    min={PROPERTY_LIMITS.year.min}
                    max={PROPERTY_LIMITS.year.max}
                    allowDecimal={false}
                    allowNegative={false}
                    thousandSeparator={false}
                    key={form.key('year')}
                    {...form.getInputProps('year')}
                  />
                </SimpleGrid>
              </SectionCard>

              <SectionCard
                icon={IconPhoto}
                title="Fotos"
                description={
                  propertyId
                    ? 'Las fotos nuevas quedan pendientes hasta que las suba o guarde los cambios.'
                    : 'Se suben después de crear la propiedad. Hasta que no se publique, solo están en este navegador.'
                }
              >
                <PropertyPhotos
                  photos={photos}
                  queue={queue}
                  onAdd={addFiles}
                  onRemoveQueued={removeQueued}
                  onDeletePhoto={deletePhoto}
                  onUploadNow={propertyId ? handleUploadNow : undefined}
                  busy={busy}
                />
              </SectionCard>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Box pos={{ lg: 'sticky' }} top={24}>
              <SectionCard
                icon={IconBuildingSkyscraper}
                title="Publicación"
                description="Agencia responsable de la propiedad."
              >
                <Select
                  label="Agencia"
                  placeholder={agencies.state === 'loading' ? 'Cargando agencias...' : 'Elegir'}
                  data={agencies.options}
                  searchable
                  nothingFoundMessage="Sin coincidencias"
                  withAsterisk
                  // El backend responde 400 si un PUT cambia idAgency: no se mueve de agencia.
                  disabled={propertyId != null || agencies.state === 'loading'}
                  description={propertyId != null ? 'No se puede cambiar una vez publicada.' : undefined}
                  key={form.key('idAgency')}
                  {...form.getInputProps('idAgency')}
                />
                {agencies.state === 'error' && (
                  <Text size="sm" c="red" mt="xs">
                    No se pudieron cargar las agencias: {agencies.message}
                  </Text>
                )}
                {agencies.state === 'ready' && agencies.options.length === 0 && (
                  <Text size="sm" c="dimmed" mt="xs">
                    No hay agencias activas.{' '}
                    <Anchor component={Link} to="/dashboard/agencias/nueva" size="sm">
                      Dar de alta una agencia
                    </Anchor>
                  </Text>
                )}

                <List size="sm" c="dimmed" mt="lg" spacing={4}>
                  <List.Item>
                    Fotos: {photos.length} publicadas
                    {queue.length > 0 && `, ${queue.length} pendientes`} (máximo {PHOTO_LIMITS.maxPhotos}).
                  </List.Item>
                  <List.Item>El año de construcción es opcional.</List.Item>
                  <List.Item>La baja de la propiedad es lógica y se puede restaurar.</List.Item>
                </List>
              </SectionCard>
            </Box>
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
              {status.state === 'uploading'
                ? 'Subiendo fotos...'
                : queue.length > 0
                  ? `${queue.length} ${queue.length === 1 ? 'foto se subirá' : 'fotos se subirán'} al guardar.`
                  : 'Los campos con * son obligatorios.'}
            </Text>
            <Group gap="sm" ml="auto" wrap="nowrap">
              <Button component={Link} to={LIST_PATH} variant="subtle" color="gray" disabled={busy}>
                Volver al listado
              </Button>
              <Button type="submit" leftSection={<IconCircleCheck size={18} />} loading={busy}>
                {propertyId ? 'Guardar cambios' : 'Publicar propiedad'}
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>
    </form>
  )
}

/** Trae la propiedad antes de montar el editor, así el formulario nace con sus valores. */
function PropertyLoader({ id }) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    findProperty(id, { signal: controller.signal })
      .then((property) => setResult({ property }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setResult({
          error:
            error instanceof ApiError && error.status === 404
              ? `No existe una propiedad activa con el identificador #${id}.`
              : error.message,
        })
      })

    return () => controller.abort()
  }, [id])

  if (!result) {
    return (
      <>
        <PageHeader propertyId={id} />
        <Container size="xl" py="xl">
          <Stack gap="xl">
            <Skeleton height={160} radius="lg" />
            <Skeleton height={220} radius="lg" />
            <Skeleton height={260} radius="lg" />
          </Stack>
        </Container>
      </>
    )
  }

  if (result.error || result.property.active === false) {
    return (
      <>
        <PageHeader propertyId={id} />
        <Container size="xl" py="xl">
          <Alert color="red" icon={<IconAlertTriangle />} title="No se puede editar la propiedad">
            {result.error ?? 'La propiedad está dada de baja. Restáurela desde Archivados para editarla.'}{' '}
            <Anchor component={Link} to={LIST_PATH} size="sm" fw={500}>
              Volver al listado
            </Anchor>
          </Alert>
        </Container>
      </>
    )
  }

  return <PropertyEditor property={result.property} />
}

/** `/propiedades/nueva` y `/propiedades/:id/editar`. */
export default function PropertyForm() {
  const { id } = useParams()
  return id ? <PropertyLoader key={id} id={id} /> : <PropertyEditor key="new" />
}
