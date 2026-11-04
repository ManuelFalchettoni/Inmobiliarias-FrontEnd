import { Button } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'

import { pinIcon } from './map-pin.js'
import classes from './PropertyMap.module.css'

/** -32.9468 -> "32°56′48″"; el signo lo pone el hemisferio. */
function toDegrees(value) {
  const abs = Math.abs(value)
  const degrees = Math.floor(abs)
  const minutesFull = (abs - degrees) * 60
  const minutes = Math.floor(minutesFull)
  const seconds = Math.round((minutesFull - minutes) * 60)
  return `${degrees}°${minutes}′${seconds}″`
}

/** "32°56′48″ S, 60°39′22″ O": la forma en que se leen en un plano. */
function formatCoordinates(latitude, longitude) {
  const lat = `${toDegrees(latitude)} ${latitude < 0 ? 'S' : 'N'}`
  const lng = `${toDegrees(longitude)} ${longitude < 0 ? 'O' : 'E'}`
  return `${lat}, ${lng}`
}

/**
 * Mapa de la propiedad en la ficha.
 *
 * Con coordenadas muestra un mapa de OpenStreetMap (Leaflet) centrado en el
 * punto, con el pin marcándolo. Sin coordenadas deja el papel cuadriculado
 * con el lugar en texto (`place`).
 */
export default function PropertyMap({ latitude, longitude, place }) {
  const hasPoint = latitude != null && longitude != null

  if (!hasPoint) {
    return (
      <div className={classes.frame}>
        <div className={classes.grid} />
        <div className={classes.empty}>
          {place && <span className={classes.emptyPlace}>{place}</span>}
          <span>Sin ubicación exacta cargada</span>
        </div>
      </div>
    )
  }

  const link = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`

  return (
    <div className={classes.frame}>
      {/* scrollWheelZoom apagado: si no, al bajar por la ficha la rueda hace zoom en el mapa */}
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        scrollWheelZoom={false}
        className={classes.map}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={pinIcon} interactive={false} />
      </MapContainer>
      <span className={classes.coords}>{formatCoordinates(latitude, longitude)}</span>
      <Button
        component="a"
        href={link}
        target="_blank"
        rel="noreferrer"
        size="xs"
        variant="white"
        color="dark"
        className={classes.open}
        rightSection={<IconExternalLink size={14} />}
      >
        Abrir en OpenStreetMap
      </Button>
    </div>
  )
}
