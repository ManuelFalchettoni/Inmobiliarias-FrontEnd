import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Anchor, Box, Button, Container, Image, ScrollArea, Skeleton, Stack, UnstyledButton } from '@mantine/core'
import { Carousel } from '@mantine/carousel'
import '@mantine/carousel/styles.css'
// Archivo con eje de ancho: la versión angosta es la de la dirección y las
// cifras. Se importa acá y no en main.jsx para que solo la descargue la ficha.
import '@fontsource-variable/archivo/wdth.css'
import { IconAlertTriangle, IconArrowLeft, IconMail, IconMapPin, IconPhone, IconWorld } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../queries/keys.js'
import { findAgency } from '../../../services/agencies.js'
import { ApiError } from '../../../services/api.js'
import {
  OPERATION_TYPE_LABEL,
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
import PropertyMap from './PropertyMap.jsx'
import classes from './PropertySheet.module.css'

/**
 * Galería: la foto grande en un carrusel y las miniaturas abajo. Elegir una
 * miniatura mueve el carrusel; mover el carrusel marca la miniatura.
 */
function Gallery({ photos, property }) {
  const [embla, setEmbla] = useState(null)
  const [active, setActive] = useState(0)

  if (photos.length === 0) {
    return (
      <div className={classes.gallery}>
        <div className={classes.noPhotos}>{PROPERTY_TYPE_LABEL[property.type] ?? 'Propiedad'} sin fotos</div>
      </div>
    )
  }

  return (
    <div className={classes.gallery}>
      <Box pos="relative">
        <Carousel
          height="var(--gallery-height)"
          withIndicators={false}
          withControls={photos.length > 1}
          controlSize={40}
          emblaOptions={{ loop: true }}
          getEmblaApi={setEmbla}
          onSlideChange={setActive}
          className={classes.slides}
        >
          {photos.map((photo, index) => (
            <Carousel.Slide key={photo.id}>
              <Image src={photo.url} alt={`${property.address}, foto ${index + 1}`} h="100%" fit="cover" />
            </Carousel.Slide>
          ))}
        </Carousel>
        {photos.length > 1 && (
          <span className={classes.counter}>
            {active + 1} de {photos.length}
          </span>
        )}
      </Box>

      {photos.length > 1 && (
        <ScrollArea type="auto" offsetScrollbars>
          <div className={classes.thumbs}>
            {photos.map((photo, index) => (
              <UnstyledButton
                key={photo.id}
                className={classes.thumb}
                data-active={index === active || undefined}
                onClick={() => embla?.scrollTo(index)}
                aria-label={`Ver la foto ${index + 1}`}
                aria-current={index === active || undefined}
              >
                <Image src={photo.url} alt="" h="100%" w="100%" fit="cover" />
              </UnstyledButton>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

/** "Casa en venta", "Departamento en venta y alquiler"; sin precios, solo el tipo. */
function describeKind(property, prices) {
  const type = PROPERTY_TYPE_LABEL[property.type] ?? property.type
  const operations = prices.map((price) => (OPERATION_TYPE_LABEL[price.operationType] ?? '').toLowerCase())
  return operations.length > 0 ? `${type} en ${operations.join(' y ')}` : type
}

/**
 * Ficha técnica con forma de rótulo de plano: cada dato en su celda y, al pie,
 * la referencia para que el cliente la cite al consultar.
 */
function Rotulo({ property }) {
  const floor = formatFloor(property.floorNumber)

  // Los datos que no vienen (año, piso) no se muestran: mejor nada que un guion.
  const cells = [
    { label: 'Superficie', value: property.size, unit: 'm²' },
    property.rooms > 0 && { label: 'Ambientes', value: property.rooms },
    property.year && { label: 'Año de construcción', value: property.year },
    floor && property.type !== 'LAND' && { label: 'Ubicación en el edificio', value: floor, text: true },
    { label: 'Estado', value: PROPERTY_CONDITION_LABEL[property.condition] ?? property.condition, text: true },
    { label: 'Ocupación', value: PROPERTY_OCCUPANCY_LABEL[property.occupancy] ?? property.occupancy, text: true },
  ].filter(Boolean)

  return (
    <div className={classes.rotulo}>
      <dl className={classes.rotuloGrid} style={{ margin: 0 }}>
        {cells.map((cell) => (
          <div key={cell.label} className={classes.cell}>
            <dt className={classes.cellLabel}>{cell.label}</dt>
            <dd className={classes.cellValue} data-text={cell.text || undefined} style={{ margin: 0 }}>
              {cell.value}
              {cell.unit && <span className={classes.cellUnit}>{cell.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className={classes.rotuloFoot}>
        <span>
          Referencia <span className={classes.rotuloRef}>#{property.id}</span>
        </span>
      </div>
    </div>
  )
}

/**
 * Precios en grande y, debajo, la inmobiliaria con botones para llamar o
 * escribir. En la venta suma el valor por m². Sin precio: "Consultar".
 */
function PriceBox({ prices, size, agency }) {
  return (
    <div className={classes.priceBox}>
      <div className={classes.prices}>
        {prices.length === 0 && (
          <div>
            <span className={classes.priceOperation}>Precio</span>
            <span className={classes.priceAmount}>Consultar</span>
          </div>
        )}
        {prices.map((price) => {
          // formatPrice da "USD 95.000": la moneda va aparte, más chica.
          const [currency, amount] = formatPrice(price).split(' ')
          return (
            <div key={price.id}>
              <span className={classes.priceOperation}>
                {OPERATION_TYPE_LABEL[price.operationType] ?? price.operationType}
              </span>
              <span className={classes.priceAmount}>
                <span className={classes.priceCurrency}>{currency}</span>
                {amount}
              </span>
              {price.operationType === 'SALE' && size > 0 && (
                <span className={classes.priceNote}>
                  {formatPrice({ currency: price.currency, amount: Math.round(price.amount / size) })} por m²
                </span>
              )}
              {price.operationType === 'RENT' && <span className={classes.priceNote}>por mes</span>}
            </div>
          )
        })}
      </div>

      {agency && (
        <div className={classes.agency}>
          <span className={classes.priceOperation}>Publica</span>
          <p className={classes.agencyName}>{agency.publicName}</p>
          <Stack gap="xs">
            {agency.phoneNumber && (
              <Button
                component="a"
                href={`tel:${agency.phoneNumber}`}
                variant="white"
                color="dark"
                leftSection={<IconPhone size={18} />}
                fullWidth
              >
                Llamar al {agency.phoneNumber}
              </Button>
            )}
            {agency.email && (
              <Button
                component="a"
                href={`mailto:${agency.email}`}
                variant="outline"
                color="gray.3"
                leftSection={<IconMail size={18} />}
                fullWidth
              >
                Escribir por email
              </Button>
            )}
          </Stack>
          {agency.webURL && (
            <a href={agency.webURL} target="_blank" rel="noreferrer" className={classes.agencyWeb}>
              <IconWorld size={16} />
              {agency.webURL.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function Sheet({ property }) {
  const agency = useQuery({
    queryKey: queryKeys.agencies.detail(property.agencyId),
    queryFn: ({ signal }) => findAgency(property.agencyId, { signal }),
  }).data

  const photos = sortPhotos(property.photos)
  const prices = sortPrices(property.prices ?? [])
  const place = formatPropertyPlace(property)

  return (
    <>
      <Gallery photos={photos} property={property} />

      <div className={classes.layout}>
        <header className={classes.head}>
          <p className={classes.kind}>{describeKind(property, prices)}</p>
          <h1 className={classes.address}>{property.address}</h1>
          {place && (
            <p className={classes.place}>
              <IconMapPin size={20} stroke={1.6} />
              {place}
            </p>
          )}
        </header>

        <aside className={classes.aside}>
          <PriceBox prices={prices} size={property.size} agency={agency} />
        </aside>

        <div className={classes.body}>
          <section>
            <h2 className={classes.sectionTitle}>Ficha técnica</h2>
            <Rotulo property={property} />
          </section>

          <section>
            <h2 className={classes.sectionTitle}>Ubicación</h2>
            <PropertyMap latitude={property.latitude} longitude={property.longitude} place={place} />
          </section>
        </div>
      </div>
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
    <div className={classes.page}>
      <Container size="lg">
        <div className={classes.topBar}>
          <Button variant="subtle" color="dark" leftSection={<IconArrowLeft size={18} />} onClick={goBack}>
            Volver
          </Button>
        </div>

        {query.data && <Sheet property={query.data} />}

        {query.isPending && (
          <Stack gap="xl">
            <Skeleton height={480} radius={6} />
            <Skeleton height={64} width="60%" />
            <Skeleton height={180} radius={6} />
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
    </div>
  )
}
