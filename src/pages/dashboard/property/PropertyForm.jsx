import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  IconCurrencyDollar,
  IconHome,
  IconMapPin,
  IconPhoto,
  IconUsers,
} from '@tabler/icons-react'

import { ApiError } from '../../../services/api.js'
import { useAgencyOptions } from '../../../hooks/useAgencyOptions.js'
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
  sortPrices,
  syncPropertyPrices,
  toPropertyFormValues,
  toPropertyRequest,
  updateProperty,
  uploadPropertyPhotos,
} from '../../../services/properties.js'
import PropertyPhotos from './PropertyPhotos.jsx'
import PropertyOwners from './PropertyOwners.jsx'
import PropertyPrices from './PropertyPrices.jsx'
import { propertyDefaultValues, propertyValidation } from './property-form.js'

/**
 * Alta y edición de propiedades (`/propiedades/nueva` y `/propiedades/:id/editar`).
 * Junta en una pantalla los datos de la propiedad, sus precios, sus dueños y sus
 * fotos; cada parte se guarda en su propio endpoint del backend.
 */

const LIST_PATH = '/dashboard/propiedades'
const editPath = (id) => `${LIST_PATH}/${id}/editar`

/**
 * Tarjeta con ícono, título y descripción. `children` es el contenido que va
 * entre `<SectionCard>` y `</SectionCard>`.
 */
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

/** Encabezado con "migas de pan" (Breadcrumbs) y título según si es alta o edición. */
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
 * El formulario en sí. Sirve para crear (sin `property`) y para editar (con
 * `property`, que trae PropertyLoader más abajo).
 */
function PropertyEditor({ property }) {
  const navigate = useNavigate()
  const location = useLocation()
  // Al volver del alta de una persona llega `?peopleId=` para elegirla como dueña.
  const [searchParams] = useSearchParams()

  // Con `property` se edita; sin ella, el id aparece cuando el alta responde.
  const [createdId, setCreatedId] = useState(null)
  const propertyId = property?.id ?? createdId

  // `useState(() => ...)`: la función solo corre la primera vez (inicialización
  // perezosa), no en cada render.
  // `photos`: las fotos ya subidas al backend.
  const [photos, setPhotos] = useState(() => sortPhotos(property?.photos))
  // Lo que hay guardado en el backend; el formulario tiene lo que se quiere guardar.
  const [prices, setPrices] = useState(() => sortPrices(property?.prices))
  // `queue`: fotos elegidas que todavía no se subieron (con su vista previa).
  const [queue, setQueue] = useState([])
  // Si venimos de un alta exitosa, la navegación trae `state.created` y se
  // muestra el aviso "Propiedad publicada".
  const [status, setStatus] = useState(() =>
    location.state?.created ? { state: 'created' } : { state: 'idle' },
  )

  const abortRef = useRef(null)
  // Copia de la cola en un ref: la limpieza del efecto de abajo corre al
  // desmontar y necesita la cola ACTUAL, no la del primer render.
  const queueRef = useRef(queue)

  const initialValues = property ? toPropertyFormValues(property) : propertyDefaultValues
  const agencies = useAgencyOptions(initialValues.agencyId)

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

  /** Cancela el pedido anterior (si había) y devuelve la señal del nuevo. */
  const startRequest = () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    return controller.signal
  }

  const addFiles = (files) => {
    // Las URLs se crean fuera del updater: en StrictMode el updater corre dos veces.
    const items = files.map((file) => ({
      // Identificador único que genera el navegador, para el `key` de la lista.
      key: crypto.randomUUID(),
      file,
      // Dirección temporal "blob:..." que apunta al archivo en la memoria del
      // navegador: permite ver la foto antes de subirla. Hay que liberarla
      // con revokeObjectURL cuando ya no se usa.
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

  // Cambia algunos campos de una foto de la cola (por ejemplo su `status`).
  // La forma con función `(current) => ...` recibe siempre la cola más reciente:
  // dentro del bucle de subida hay varias actualizaciones seguidas y, si se
  // usara `queue` directo, se pisarían entre sí.
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

    // El `await` dentro del `for` hace que espere a que termine una foto antes
    // de empezar la siguiente.
    for (const item of queue) {
      if (signal.aborted) break
      patchQueued(item.key, { status: 'uploading', error: null })

      try {
        // El backend responde un array con las fotos creadas; con `[photo]` se
        // toma la primera (y única).
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

  /** Desplaza la página hasta el campo con error y le pone el cursor. */
  const focusField = (path) => {
    const node = form.getInputNode(path)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.focus({ preventScroll: true })
  }

  /**
   * Guardar: 1) crear o actualizar la propiedad, 2) sincronizar los precios,
   * 3) subir las fotos pendientes. Cada paso necesita el id del primero.
   */
  const handleSubmit = async (values) => {
    const signal = startRequest()
    const isNew = propertyId == null
    let id = propertyId

    setStatus({ state: 'saving' })

    // Paso 1. Si falla, no tiene sentido seguir: se muestra el error y se corta.
    try {
      const request = toPropertyRequest(values)
      if (isNew) {
        const created = await createProperty(request, { signal })
        id = created.id
        // Desde acá la pantalla ya conoce el id: si después falla una foto y se
        // vuelve a guardar, se hace PUT y no se crea otra propiedad.
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

    // Los precios van por su propio endpoint: si fallan, la propiedad ya quedó
    // guardada y se informa aparte, sin cortar la subida de fotos.
    let pricesError = null
    try {
      setPrices(await syncPropertyPrices(id, prices, values.prices, { signal }))
    } catch (error) {
      if (signal.aborted) return
      setPrices(error.savedPrices ?? prices)
      pricesError = error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.'
    }

    // Paso 3: las fotos.
    if (queue.length > 0) setStatus({ state: 'uploading' })
    const failed = await uploadQueue(id, signal)
    if (signal.aborted) return

    // Alta completa: se pasa a la URL de edición para que recargar no duplique el alta.
    // `replace: true` reemplaza "nueva" en el historial: "Atrás" no vuelve a un
    // formulario de alta vacío.
    if (isNew && failed === 0 && !pricesError) {
      navigate(editPath(id), { replace: true, state: { created: true } })
      return
    }

    setStatus(
      failed > 0 || pricesError
        ? { state: 'partial', failed, pricesError, isNew, id }
        : { state: 'saved' },
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Se llama cuando la validación del formulario falla: lleva al primer error.
  const handleSubmitFail = (errors) => {
    const [firstPath] = Object.keys(errors)
    if (firstPath) focusField(firstPath)
  }

  /** Botón "Subir ahora" (solo en edición): sube la cola sin guardar el resto. */
  const handleUploadNow = async () => {
    const signal = startRequest()
    setStatus({ state: 'uploading' })
    const failed = await uploadQueue(propertyId, signal)
    if (signal.aborted) return
    setStatus(failed > 0 ? { state: 'partial', failed, isNew: false, id: propertyId } : { state: 'photos-saved' })
  }

  const onSubmit = (event) => form.onSubmit(handleSubmit, handleSubmitFail)(event)
  // Mientras se guarda o se suben fotos, los botones quedan deshabilitados.
  const busy = status.state === 'saving' || status.state === 'uploading'
  const dismiss = () => setStatus({ state: 'idle' })

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader propertyId={propertyId} />

      <Container size="xl" py="xl">
        {/* Un aviso distinto según cómo terminó el guardado. `condición && <X/>`
            dibuja X solo si la condición se cumple. */}
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
            title={
              status.pricesError
                ? 'Los precios no se guardaron'
                : status.failed === 1
                  ? 'Una foto no se pudo subir'
                  : `${status.failed} fotos no se pudieron subir`
            }
            mb="lg"
            withCloseButton
            onClose={dismiss}
          >
            {status.isNew
              ? `La propiedad se creó con el identificador #${status.id}. `
              : 'Los datos se guardaron. '}
            {status.pricesError &&
              `Los precios fallaron con "${status.pricesError}": revíselos y vuelva a guardar. `}
            {status.failed > 0 &&
              'El motivo de cada foto figura en su miniatura: puede quitarla o volver a intentarlo.'}
          </Alert>
        )}
        {status.state === 'error' && (
          <Alert color="red" icon={<IconAlertTriangle />} title={status.title} mb="lg" withCloseButton onClose={dismiss}>
            {status.message}
          </Alert>
        )}

        {/* Grilla de 12 columnas: en pantallas grandes (lg) el formulario ocupa 8
            y la tarjeta lateral 4; en chicas (base) cada una ocupa las 12. */}
        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="xl">
              <SectionCard
                icon={IconMapPin}
                title="Ubicación"
                description="Dirección exacta del inmueble y la zona donde se publica."
              >
                {/* `maxLength` usa el mismo límite del backend: no deja escribir de más.
                    `withAsterisk` solo pinta el asterisco; la obligación está en las reglas. */}
                <TextInput
                  label="Dirección"
                  placeholder="Av. Colón 1234, 5° B"
                  description={`Hasta ${PROPERTY_LIMITS.address.max} caracteres`}
                  withAsterisk
                  maxLength={PROPERTY_LIMITS.address.max}
                  key={form.key('address')}
                  {...form.getInputProps('address')}
                />
                <SimpleGrid cols={{ base: 1, sm: 3 }} mt="md">
                  <TextInput
                    label="Provincia"
                    placeholder="Santa Fe"
                    withAsterisk
                    maxLength={PROPERTY_LIMITS.province.max}
                    key={form.key('province')}
                    {...form.getInputProps('province')}
                  />
                  <TextInput
                    label="Partido o departamento"
                    placeholder="Opcional"
                    maxLength={PROPERTY_LIMITS.county.max}
                    key={form.key('county')}
                    {...form.getInputProps('county')}
                  />
                  <TextInput
                    label="Ciudad"
                    placeholder="Rosario"
                    withAsterisk
                    maxLength={PROPERTY_LIMITS.city.max}
                    key={form.key('city')}
                    {...form.getInputProps('city')}
                  />
                </SimpleGrid>
                {/* `decimalScale={7}`: hasta 7 decimales (precisión de ~1 cm).
                    `thousandSeparator={false}` para que -32.9468 no se vea con puntos de miles. */}
                <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
                  <NumberInput
                    label="Latitud"
                    placeholder="-32.9468"
                    description="Opcional; va junto con la longitud"
                    min={PROPERTY_LIMITS.latitude.min}
                    max={PROPERTY_LIMITS.latitude.max}
                    decimalScale={7}
                    thousandSeparator={false}
                    key={form.key('latitude')}
                    {...form.getInputProps('latitude')}
                  />
                  <NumberInput
                    label="Longitud"
                    placeholder="-60.6393"
                    description="Ubica la propiedad en el mapa"
                    min={PROPERTY_LIMITS.longitude.min}
                    max={PROPERTY_LIMITS.longitude.max}
                    decimalScale={7}
                    thousandSeparator={false}
                    key={form.key('longitude')}
                    {...form.getInputProps('longitude')}
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
                {/* `allowDecimal` y `allowNegative` en false: el input no deja escribir
                    "3.5" ni "-1". La validación igual lo revisa por si llega otro valor. */}
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
                icon={IconCurrencyDollar}
                title="Precios"
                description="Operaciones en las que se ofrece la propiedad y su precio."
              >
                {/* Se le pasa el `form`: las filas de precios son campos del mismo
                    formulario (prices.SALE, prices.RENT). */}
                <PropertyPrices form={form} disabled={busy} />
              </SectionCard>

              <SectionCard
                icon={IconUsers}
                title="Dueños"
                description={
                  propertyId
                    ? 'Se guardan al instante, aparte de los cambios de la propiedad.'
                    : 'Se cargan después de publicar la propiedad.'
                }
              >
                {/* Los dueños se vinculan a la propiedad por su id: en un alta
                    todavía no existe, así que la sección solo funciona al editar. */}
                {propertyId ? (
                  <PropertyOwners propertyId={propertyId} initialPeopleId={searchParams.get('peopleId')} />
                ) : (
                  <Text size="sm" c="dimmed">
                    Publique la propiedad y después agregue a sus dueños desde esta misma pantalla.
                  </Text>
                )}
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
                {/* PropertyPhotos solo dibuja: el estado (fotos y cola) vive acá y
                    se le pasan funciones para avisar cambios ("levantar el estado"). */}
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
            {/* `sticky`: en pantallas grandes la tarjeta acompaña el scroll. */}
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
                  // El backend responde 400 si un PUT cambia agencyId: no se mueve de agencia.
                  disabled={propertyId != null || agencies.state === 'loading'}
                  description={propertyId != null ? 'No se puede cambiar una vez publicada.' : undefined}
                  key={form.key('agencyId')}
                  {...form.getInputProps('agencyId')}
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

      {/* Barra inferior pegada al fondo de la pantalla con los botones, para
          no tener que bajar hasta el final del formulario. */}
      <Box
        pos="sticky"
        bottom={0}
        bg="white"
        py="sm"
        style={{ borderTop: '1px solid var(--mantine-color-gray-2)', zIndex: 10 }}
      >
        <Container size="xl">
          <Group justify="space-between" gap="sm" wrap="nowrap">
            {/* Ternarios encadenados: a ? b : (c ? d : e). */}
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

/**
 * Trae la propiedad antes de montar el editor, así el formulario nace con sus valores.
 * `useForm` toma los valores iniciales una sola vez: si el editor se creara
 * vacío y la propiedad llegara después, habría que pisar los campos a mano.
 */
function PropertyLoader({ id }) {
  // null = cargando; { property } = listo; { error } = falló.
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

  // Mientras carga: rectángulos grises animados (Skeleton) con la forma del formulario.
  // `<>...</>` es un Fragment: agrupa sin agregar un elemento al HTML.
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
  // `id` sale de la ruta `propiedades/:id/editar`; en `propiedades/nueva` no hay.
  const { id } = useParams()
  // `key`: si cambia, React descarta el componente y crea uno nuevo. Pasar de
  // editar la propiedad 1 a la 2 arranca un formulario limpio.
  return id ? <PropertyLoader key={id} id={id} /> : <PropertyEditor key="new" />
}
