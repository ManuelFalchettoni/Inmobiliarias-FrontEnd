import { Button } from '@mantine/core'
import { IconExternalLink, IconMapPinFilled } from '@tabler/icons-react'

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
 * Lugar reservado para el mapa de la propiedad.
 *
 * Hoy dibuja un papel cuadriculado con el pin en el centro y las coordenadas.
 * Para sumar una librería de mapas (Leaflet, MapLibre) alcanza con reemplazar
 * el contenido de `.frame` por el mapa: el contenedor ya tiene su tamaño y su
 * borde, y la ficha no necesita cambios. Sin coordenadas muestra el lugar en
 * texto (`place`).
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
      <div className={`${classes.grid} ${classes.crosshair}`} />
      <span className={classes.pinDot} />
      <IconMapPinFilled className={classes.pin} size={40} aria-hidden />
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
