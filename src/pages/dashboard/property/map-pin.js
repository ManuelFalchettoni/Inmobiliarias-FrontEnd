import L from 'leaflet'

/**
 * Pin rojo de las propiedades, para todos los mapas (ficha y listado).
 *
 * Es un SVG dentro de un divIcon. El Marker común de Leaflet usa una imagen
 * que con Vite no se encuentra sin configuración extra; con un divIcon el
 * dibujo va en el código. La punta del pin (iconAnchor) es el punto exacto, y
 * popupAnchor abre el globo justo arriba de la cabeza del pin.
 *
 * `className: ''` saca el fondo blanco y el borde que Leaflet les pone a los divIcon.
 */
export const pinIcon = L.divIcon({
  className: '',
  html: `
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"
         style="filter: drop-shadow(0 2px 2px rgba(23, 38, 42, 0.35))">
      <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 41 15 41s14-15.7 14-26.1C29 7.2 22.7 1 15 1z"
            fill="#d63031" stroke="#7a1414" stroke-width="1.5"/>
      <circle cx="15" cy="15" r="5.5" fill="#f8faf9"/>
    </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 41],
  popupAnchor: [0, -38],
})
