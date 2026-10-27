import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  AspectRatio,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Image,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { Carousel } from '@mantine/carousel'
import '@mantine/carousel/styles.css'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBuildingEstate,
  IconCalendar,
  IconDoor,
  IconExternalLink,
  IconHomeCheck,
  IconKey,
  IconMail,
  IconMapPin,
  IconPhone,
  IconRuler2,
  IconStairs,
  IconWorld,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../queries/keys.js'
import { findAgency } from '../../../services/agencies.js'
import { ApiError } from '../../../services/api.js'
import {
  OPERATION_TYPE_LABEL,
  PROPERTY_CONDITION_COLOR,
  PROPERTY_CONDITION_LABEL,
  PROPERTY_OCCUPANCY_LABEL,
  PROPERTY_TYPE_LABEL,
  findProperty,
  formatFloor,
  formatPrice,
  formatPropertyPlace,
  sortPhotos,
  sortPrices,
} from '../../../services/properties.js'

const GALLERY_HEIGHT = 460

/** Degradé del encabezado, con el color de la marca (teal) hacia un azul profundo. */
const HERO_BACKGROUND =
  'linear-gradient(135deg, var(--mantine-color-teal-8) 0%, var(--mantine-color-teal-6) 45%, var(--mantine-color-cyan-8) 100%)'

/** Círculo translúcido de adorno en el encabezado. */
function Bubble({ size, top, left, right, opacity = 0.08 }) {
  return (
    <Box
      pos="absolute"
      top={top}
      left={left}
      right={right}
      w={size}
      h={size}
      style={{ borderRadius: '50%', background: `rgba(255, 255, 255, ${opacity})`, pointerEvents: 'none' }}
    />
  )
}

/** "Juan Pérez" -> "JP"; "Zaguan" -> "ZA". */
function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Galería: la foto grande en un carrusel y las miniaturas abajo. Elegir una
 * miniatura mueve el carrusel; mover el carrusel marca la miniatura.
 */
function Gallery({ photos, property }) {
  const [embla, setEmbla] = useState(null)
  const [active, setActive] = useState(0)

  // Sin fotos: un panel con el degradé de la marca y el tipo de propiedad, en
  // lugar de un recuadro gris vacío.
  if (photos.length === 0) {
    return (
      <Center
        h={GALLERY_HEIGHT * 0.7}
        style={{
          borderRadius: 'var(--mantine-radius-lg)',
          background:
            'linear-gradient(135deg, var(--mantine-color-teal-0) 0%, var(--mantine-color-cyan-1) 100%)',
        }}
      >
        <Stack align="center" gap="sm">
          <ThemeIcon size={88} radius={44} variant="white" color="teal" style={{ boxShadow: 'var(--mantine-shadow-md)' }}>
            <IconBuildingEstate size={46} stroke={1.4} />
          </ThemeIcon>
          <Text fw={600} c="teal.9">
            {PROPERTY_TYPE_LABEL[property.type] ?? 'Propiedad'} en {property.city}
          </Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Stack gap="sm">
      <Box pos="relative">
        <Carousel
          height={GALLERY_HEIGHT}
          withIndicators={photos.length > 1}
          withControls={photos.length > 1}
          controlSize={40}
          emblaOptions={{ loop: true }}
          getEmblaApi={setEmbla}
          onSlideChange={setActive}
          style={{ borderRadius: 'var(--mantine-radius-lg)', overflow: 'hidden' }}
        >
          {photos.map((photo, index) => (
            <Carousel.Slide key={photo.id}>
              <Image src={photo.url} alt={`${property.address}, foto ${index + 1}`} h={GALLERY_HEIGHT} fit="cover" />
            </Carousel.Slide>
          ))}
        </Carousel>
        <Badge pos="absolute" top={16} right={16} size="lg" variant="filled" color="dark" style={{ opacity: 0.8 }}>
          {active + 1} / {photos.length}
        </Badge>
      </Box>

      {photos.length > 1 && (
        <ScrollArea type="auto" offsetScrollbars>
          <Group gap="xs" wrap="nowrap">
            {photos.map((photo, index) => (
              <UnstyledButton
                key={photo.id}
                onClick={() => embla?.scrollTo(index)}
                aria-label={`Ver la foto ${index + 1}`}
                style={{
                  borderRadius: 'var(--mantine-radius-md)',
                  overflow: 'hidden',
                  flex: '0 0 96px',
                  outline: index === active ? '2px solid var(--mantine-primary-color-filled)' : 'none',
                  outlineOffset: 2,
                  opacity: index === active ? 1 : 0.6,
                  transition: 'opacity 150ms',
                }}
              >
                <Image src={photo.url} alt="" h={64} w={96} fit="cover" />
              </UnstyledButton>
            ))}
          </Group>
        </ScrollArea>
      )}
    </Stack>
  )
}

/** Un dato en un mosaico de color: ícono, etiqueta y valor. */
function Feature({ icon: Icon, label, value, color }) {
  return (
    <Box
      p="md"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        background: `var(--mantine-color-${color}-0)`,
        border: `1px solid var(--mantine-color-${color}-1)`,
      }}
    >
      <ThemeIcon variant="filled" color={color} size={38} radius="md" mb="sm">
        <Icon size={20} stroke={1.8} />
      </ThemeIcon>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.4}>
        {label}
      </Text>
      <Text fw={700} size="lg" lh={1.3}>
        {value}
      </Text>
    </Box>
  )
}

/** Título de sección con una barrita de color a la izquierda. */
function SectionTitle({ children }) {
  return (
    <Group gap="sm" mb="lg">
      <Box w={4} h={22} bg="teal.6" style={{ borderRadius: 2 }} />
      <Title order={2} size="h3">
        {children}
      </Title>
    </Group>
  )
}

/** Mapa de OpenStreetMap embebido, con un pin en las coordenadas de la propiedad. */
function LocationMap({ latitude, longitude }) {
  const delta = 0.004
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',')
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`
  const link = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`

  return (
    <>
      <AspectRatio ratio={16 / 7} style={{ borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
        <iframe title="Ubicación de la propiedad" src={embed} style={{ border: 0 }} loading="lazy" />
      </AspectRatio>
      <Button
        component="a"
        href={link}
        target="_blank"
        rel="noreferrer"
        variant="light"
        size="xs"
        mt="sm"
        rightSection={<IconExternalLink size={14} />}
      >
        Abrir en el mapa
      </Button>
    </>
  )
}

/**
 * Precios de venta y alquiler, en grande. En la venta suma el valor por m²,
 * que sale del precio y la superficie. Sin precio: "Consultar".
 */
function PriceCard({ prices, size }) {
  const sorted = sortPrices(prices)
  return (
    <Card radius="lg" padding={0} shadow="md" style={{ overflow: 'hidden' }}>
      <Box h={6} style={{ background: HERO_BACKGROUND }} />
      <Box p="xl">
        {sorted.length === 0 ? (
          <>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Precio
            </Text>
            <Text fz={30} fw={800}>
              Consultar
            </Text>
          </>
        ) : (
          <Stack gap="lg">
            {sorted.map((price, index) => (
              <div key={price.id}>
                {index > 0 && <Divider mb="lg" variant="dashed" />}
                <Badge variant="light" mb={6}>
                  {OPERATION_TYPE_LABEL[price.operationType] ?? price.operationType}
                </Badge>
                <Text fz={32} fw={800} lh={1.15} c="teal.8">
                  {formatPrice(price)}
                </Text>
                {price.operationType === 'SALE' && size > 0 && (
                  <Text size="sm" c="dimmed" mt={2}>
                    {formatPrice({ currency: price.currency, amount: Math.round(price.amount / size) })} por m²
                  </Text>
                )}
              </div>
            ))}
          </Stack>
        )}
      </Box>
    </Card>
  )
}

/** La inmobiliaria que la publica, con botones para llamar o escribir. */
function AgencyCard({ agency }) {
  return (
    <Card radius="lg" padding="xl" shadow="md">
      <Group gap="md" wrap="nowrap" mb="lg">
        <Avatar size={52} radius="xl" color="teal" variant="filled">
          {initials(agency.publicName)}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Publica
          </Text>
          <Text fw={700} size="lg" truncate>
            {agency.publicName}
          </Text>
        </div>
      </Group>
      <Stack gap="xs">
        {agency.phoneNumber && (
          <Button component="a" href={`tel:${agency.phoneNumber}`} leftSection={<IconPhone size={18} />} fullWidth>
            {agency.phoneNumber}
          </Button>
        )}
        {agency.email && (
          <Button
            component="a"
            href={`mailto:${agency.email}`}
            variant="light"
            leftSection={<IconMail size={18} />}
            fullWidth
          >
            Escribir por email
          </Button>
        )}
        {agency.webURL && (
          <Anchor href={agency.webURL} target="_blank" rel="noreferrer" size="sm" ta="center" mt={4}>
            <Group gap={6} justify="center" wrap="nowrap">
              <IconWorld size={16} />
              {agency.webURL.replace(/^https?:\/\//, '')}
            </Group>
          </Anchor>
        )}
      </Stack>
    </Card>
  )
}

/** Encabezado con degradé: tipo, estado, dirección y lugar. */
function Hero({ property, onBack }) {
  const place = formatPropertyPlace(property)
  return (
    <Box pos="relative" pb={90} style={{ background: HERO_BACKGROUND, overflow: 'hidden' }}>
      <Bubble size={320} top={-120} right={-80} />
      <Bubble size={180} top={60} right={260} opacity={0.05} />
      <Bubble size={240} top={120} left={-100} opacity={0.06} />

      <Container size="lg" pt="lg" pos="relative">
        <Button
          variant="white"
          color="dark"
          size="xs"
          radius="xl"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onBack}
          style={{ background: 'rgba(255, 255, 255, 0.15)', color: 'white' }}
        >
          Volver
        </Button>

        <Group gap="xs" mt="xl" mb="sm">
          <Badge size="lg" variant="white" color="teal">
            {PROPERTY_TYPE_LABEL[property.type] ?? property.type}
          </Badge>
          <Badge size="lg" variant="filled" color={PROPERTY_CONDITION_COLOR[property.condition]}>
            {PROPERTY_CONDITION_LABEL[property.condition] ?? property.condition}
          </Badge>
        </Group>
        <Title order={1} c="white" fz={{ base: 30, sm: 42 }} lh={1.1}>
          {property.address}
        </Title>
        {place && (
          <Group gap={6} mt="sm" wrap="nowrap" c="white" style={{ opacity: 0.9 }}>
            <IconMapPin size={20} />
            <Text size="lg">{place}</Text>
          </Group>
        )}
      </Container>
    </Box>
  )
}

function Sheet({ property, onBack }) {
  const agency = useQuery({
    queryKey: queryKeys.agencies.detail(property.agencyId),
    queryFn: ({ signal }) => findAgency(property.agencyId, { signal }),
  }).data

  const photos = sortPhotos(property.photos)
  const floor = formatFloor(property.floorNumber)
  const hasMap = property.latitude != null && property.longitude != null

  // Los datos que no vienen (año, piso) no se muestran: mejor nada que un guion.
  const features = [
    { icon: IconRuler2, label: 'Superficie', value: `${property.size} m²`, color: 'teal' },
    property.rooms > 0 && { icon: IconDoor, label: 'Ambientes', value: property.rooms, color: 'blue' },
    property.year && { icon: IconCalendar, label: 'Año', value: property.year, color: 'grape' },
    floor && property.type !== 'LAND' && { icon: IconStairs, label: 'Ubicación', value: floor, color: 'orange' },
    {
      icon: IconHomeCheck,
      label: 'Estado',
      value: PROPERTY_CONDITION_LABEL[property.condition] ?? property.condition,
      color: 'cyan',
    },
    {
      icon: IconKey,
      label: 'Ocupación',
      value: PROPERTY_OCCUPANCY_LABEL[property.occupancy] ?? property.occupancy,
      color: 'indigo',
    },
  ].filter(Boolean)

  return (
    <>
      <Hero property={property} onBack={onBack} />

      {/* El margen negativo monta las fotos sobre el degradé del encabezado. */}
      <Container size="lg" mt={-70} pos="relative" pb={60}>
        <Card radius="lg" padding="sm" shadow="lg" mb="xl">
          <Gallery photos={photos} property={property} />
        </Card>

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="xl">
              <Card radius="lg" padding="xl" shadow="sm">
                <SectionTitle>Características</SectionTitle>
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                  {features.map((feature) => (
                    <Feature key={feature.label} {...feature} />
                  ))}
                </SimpleGrid>
              </Card>

              {hasMap && (
                <Card radius="lg" padding="xl" shadow="sm">
                  <SectionTitle>Ubicación</SectionTitle>
                  <LocationMap latitude={property.latitude} longitude={property.longitude} />
                </Card>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Box pos={{ md: 'sticky' }} top={24}>
              <Stack gap="lg">
                <PriceCard prices={property.prices ?? []} size={property.size} />
                {agency && <AgencyCard agency={agency} />}
              </Stack>
            </Box>
          </Grid.Col>
        </Grid>
      </Container>
    </>
  )
}

/**
 * `/propiedades/:id`: ficha de la propiedad para mostrarle a un cliente. Va
 * fuera del panel (sin menú lateral ni botones de edición), pero pide sesión
 * como toda la API. Arriba solo hay "Volver".
 */
export default function PropertySheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: queryKeys.properties.detail(id),
    queryFn: ({ signal }) => findProperty(id, { signal }),
  })

  // Si se entró directo (sin historial), "Volver" lleva al listado.
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard/propiedades'))

  const notFound = query.error instanceof ApiError && query.error.status === 404

  return (
    <Box bg="gray.0" mih="100vh">
      {query.data && <Sheet property={query.data} onBack={goBack} />}

      {!query.data && (
        <Container size="lg" py="lg">
          <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={18} />} onClick={goBack} mb="lg">
            Volver
          </Button>

          {query.isPending && (
            <Stack gap="xl">
              <Skeleton height={GALLERY_HEIGHT} radius="lg" />
              <Skeleton height={40} width="60%" />
              <Skeleton height={140} radius="lg" />
            </Stack>
          )}

          {query.isError && (
            <Alert color="red" icon={<IconAlertTriangle />} title="No se puede mostrar la propiedad">
              {notFound
                ? `La propiedad #${id} no existe, está dada de baja o es de otra inmobiliaria.`
                : query.error.message}{' '}
              <Anchor component={Link} to="/dashboard/propiedades" size="sm" fw={500}>
                Ir al listado
              </Anchor>
            </Alert>
          )}
        </Container>
      )}
    </Box>
  )
}
