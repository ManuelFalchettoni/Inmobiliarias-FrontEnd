import { useEffect, useState } from 'react'
import { Button, Group, Text } from '@mantine/core'
import { IconMapSearch, IconX } from '@tabler/icons-react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import { geocodeAddress } from '../../../services/geocoding.js'
import { toDecimal } from '../../../services/properties.js'
import { pinIcon } from './map-pin.js'
import classes from './PropertyLocationPicker.module.css'

// Sin ubicación, el mapa arranca en CABA con la ciudad entera a la vista.
const CENTRO_INICIAL = [-34.6037, -58.3816]

/** Las coordenadas del formulario como punto del mapa, o null si falta alguna o no es válida. */
function toPoint({ latitude, longitude }) {
  const lat = toDecimal(latitude)
  const lng = toDecimal(longitude)
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

// 7 decimales, los mismos que acepta el campo (precisión de ~1 cm).
const round = (value) => Number(value.toFixed(7))

/**
 * Mueve el mapa cuando cambia el punto. Si el punto ya está a la vista no lo
 * mueve: así arrastrar el pin no hace saltar el mapa. `focus` sí centra
 * siempre: lo usa la búsqueda de la dirección.
 */
function FollowPoint({ point, focus }) {
  const map = useMap()

  useEffect(() => {
    if (point && !map.getBounds().contains(point)) map.setView(point, Math.max(map.getZoom(), 16))
  }, [map, point])

  useEffect(() => {
    if (focus) map.setView(focus, 17)
  }, [map, focus])

  return null
}

/** Tocar el mapa pone el pin ahí. */
function ClickToPlace({ onPick }) {
  useMapEvents({
    click: (event) => onPick(event.latlng),
  })
  return null
}

/**
 * Mapa del formulario de propiedad para cargar latitud y longitud sin
 * escribirlas: se busca la dirección, se toca el mapa o se arrastra el pin.
 *
 * El formulario es `uncontrolled`: el mapa escucha los dos campos con
 * `form.watch` (así sigue también lo que se escribe a mano) y los cambia con
 * `form.setFieldValue`, que actualiza los NumberInput de arriba.
 */
export default function PropertyLocationPicker({ form }) {
  const [point, setPoint] = useState(() => toPoint(form.getValues()))
  // El punto que encontró la búsqueda: el mapa se centra en él.
  const [focus, setFocus] = useState(null)
  // idle | loading | notFound | error
  const [search, setSearch] = useState({ state: 'idle' })

  // Cualquier cambio en los campos (a mano, por el pin o por la búsqueda) mueve el pin.
  form.watch('latitude', () => setPoint(toPoint(form.getValues())))
  form.watch('longitude', () => setPoint(toPoint(form.getValues())))

  const setLocation = ({ lat, lng }) => {
    form.setFieldValue('latitude', round(lat))
    form.setFieldValue('longitude', round(lng))
  }

  const clearLocation = () => {
    form.setFieldValue('latitude', '')
    form.setFieldValue('longitude', '')
    setSearch({ state: 'idle' })
  }

  const searchAddress = async () => {
    const { address, city, province } = form.getValues()
    setSearch({ state: 'loading' })
    try {
      const found = await geocodeAddress({ address, city, province })
      if (!found) {
        setSearch({ state: 'notFound' })
        return
      }
      setLocation({ lat: found.latitude, lng: found.longitude })
      setFocus([found.latitude, found.longitude])
      setSearch({ state: 'idle' })
    } catch (error) {
      setSearch({ state: 'error', message: error.message })
    }
  }

  return (
    <div>
      <Group justify="space-between" mb="xs" gap="xs">
        <Button
          variant="light"
          size="xs"
          leftSection={<IconMapSearch size={16} />}
          loading={search.state === 'loading'}
          onClick={searchAddress}
        >
          Buscar la dirección en el mapa
        </Button>
        {point && (
          <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />} onClick={clearLocation}>
            Quitar ubicación
          </Button>
        )}
      </Group>

      <div className={classes.frame}>
        <MapContainer center={point ?? CENTRO_INICIAL} zoom={point ? 16 : 12} className={classes.map}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FollowPoint point={point} focus={focus} />
          <ClickToPlace onPick={setLocation} />
          {point && (
            <Marker
              position={point}
              icon={pinIcon}
              draggable
              eventHandlers={{ dragend: (event) => setLocation(event.target.getLatLng()) }}
            />
          )}
        </MapContainer>
      </div>

      <Text size="xs" mt={6} c={search.state === 'notFound' || search.state === 'error' ? 'red' : 'dimmed'}>
        {search.state === 'notFound'
          ? 'No encontramos esa dirección. Revisá calle, altura y ciudad, o tocá el mapa para ubicarla a mano.'
          : search.state === 'error'
            ? `No se pudo buscar la dirección: ${search.message}`
            : point
              ? 'Arrastrá el pin o tocá el mapa para corregir la ubicación.'
              : 'Buscá la dirección o tocá el mapa para ubicar la propiedad.'}
      </Text>
    </div>
  )
}
