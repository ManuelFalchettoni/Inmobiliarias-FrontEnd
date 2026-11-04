import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Anchor, Loader, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconBuildingEstate } from '@tabler/icons-react'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'

import { queryKeys } from '../../../queries/keys.js'
import {
  OPERATION_TYPE_LABEL,
  formatPrice,
  formatPropertyPlace,
  searchProperties,
  sortPhotos,
  sortPrices,
} from '../../../services/properties.js'
import { pinIcon } from './map-pin.js'
import classes from './PropertyListMap.module.css'

// Donde arranca el mapa: el centro de CABA, con la ciudad entera a la vista.
const CENTRO_INICIAL = [-34.6037, -58.3816]
const ZOOM_INICIAL = 12

// Cuántas propiedades se piden por recuadro. Si hay más, se avisa que acerque el zoom.
const MAP_SIZE = 200

/**
 * Los bordes del mapa en el formato del buscador. Se redondean a 5 decimales
 * (~1 metro): con todos los decimales, cada movimiento mínimo sería una clave
 * de caché distinta.
 */
function toBox(bounds) {
  const round = (value) => Number(value.toFixed(5))
  return {
    minLat: round(bounds.getSouth()),
    maxLat: round(bounds.getNorth()),
    minLng: round(bounds.getWest()),
    maxLng: round(bounds.getEast()),
  }
}

/**
 * Avisa los bordes del mapa: una vez al montarse (para el primer pedido) y
 * cada vez que el usuario termina de mover o hacer zoom (`moveend`).
 * No dibuja nada; tiene que estar dentro de MapContainer para usar el mapa.
 */
function BoundsWatcher({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange(toBox(map.getBounds())),
  })

  useEffect(() => {
    onChange(toBox(map.getBounds()))
  }, [map, onChange])

  return null
}

/**
 * El globo que se abre al tocar un pin: portada, dirección (abre la ficha),
 * lugar y precios. La portada es la foto con menor `position`; sin fotos, un ícono.
 */
function PropertyPopup({ property }) {
  const cover = sortPhotos(property.photos)[0]

  return (
    <div className={classes.popup}>
      <Link to={`/propiedades/${property.id}`} className={classes.cover}>
        {cover ? (
          <img src={cover.url} alt={property.address} loading="lazy" />
        ) : (
          <IconBuildingEstate size={32} />
        )}
      </Link>
      <Anchor component={Link} to={`/propiedades/${property.id}`} fw={600} size="sm">
        {property.address}
      </Anchor>
      <Text size="xs" c="dimmed">
        {formatPropertyPlace(property)}
      </Text>
      {sortPrices(property.prices).map((price) => (
        <Text key={price.id} size="sm">
          <Text span size="xs" c="dimmed">
            {OPERATION_TYPE_LABEL[price.operationType] ?? price.operationType}
          </Text>{' '}
          {formatPrice(price)}
        </Text>
      ))}
    </div>
  )
}

/**
 * Vista "Mapa" del listado de propiedades.
 *
 * Usa los mismos filtros que las otras vistas y les suma el recuadro visible
 * (`minLat`, `maxLat`, `minLng`, `maxLng`): cada vez que el usuario mueve el
 * mapa se pide al buscador lo que hay en esa zona. El recuadro no va a la URL:
 * es de esta vista y cambia con cada movimiento.
 *
 * Las propiedades sin coordenadas no aparecen: el backend las deja afuera del recuadro.
 */
export default function PropertyListMap({ filters, agencyId, sort }) {
  // null hasta que el mapa avisa sus bordes: recién ahí se puede pedir.
  const [box, setBox] = useState(null)
  // Espera 300 ms sin movimiento antes de pedir: arrastrar el mapa no dispara un pedido por cuadro.
  const [boxQuieto] = useDebouncedValue(box, 300)

  const params = { page: 0, size: MAP_SIZE, sort, agencyId, ...filters, ...boxQuieto }
  const query = useQuery({
    queryKey: queryKeys.properties.list(params),
    queryFn: ({ signal }) => searchProperties(params, { signal }),
    enabled: boxQuieto != null,
    // Mientras llega la zona nueva siguen los pines de la anterior.
    placeholderData: keepPreviousData,
  })

  const data = query.data
  const properties = data?.content ?? []

  return (
    <div>
      {/* Cartel de estado arriba del mapa: cuántas hay en la zona o qué pasó. */}
      <div className={classes.status}>
        {query.isError ? (
          <Text size="sm" c="red">
            No se pudo buscar en esta zona: {query.error.message}
          </Text>
        ) : !data ? (
          <Loader size="xs" />
        ) : data.totalElements > properties.length ? (
          <Text size="sm">
            Mostrando {properties.length} de {data.totalElements}. Acercá el zoom para ver el resto.
          </Text>
        ) : (
          <Text size="sm">
            {data.totalElements === 0
              ? 'No hay propiedades en esta zona'
              : `${data.totalElements} ${data.totalElements === 1 ? 'propiedad' : 'propiedades'} en esta zona`}
          </Text>
        )}
        {query.isFetching && data && <Loader size="xs" />}
      </div>

      <div className={classes.frame}>
        <MapContainer center={CENTRO_INICIAL} zoom={ZOOM_INICIAL} className={classes.map}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <BoundsWatcher onChange={setBox} />
          {properties.map((property) => (
            <Marker key={property.id} position={[property.latitude, property.longitude]} icon={pinIcon}>
              <Popup>
                <PropertyPopup property={property} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
