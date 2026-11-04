/**
 * Dirección -> coordenadas con Nominatim, el buscador de direcciones de
 * OpenStreetMap. Es gratis y no pide clave, pero acepta como mucho un pedido
 * por segundo: por eso se busca al tocar un botón y no mientras se escribe.
 *
 * No pasa por el backend: el navegador le pide directo a Nominatim.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/**
 * Deja solo calle y altura: "Lavalle 1200 piso 8" -> "Lavalle 1200".
 * Nominatim no entiende el piso ni el departamento y con ellos no encuentra nada.
 *  1. Lo que va después de una coma: "Av. Colón 1234, 5° B".
 *  2. Piso, PB, depto: "Lavalle 1200 piso 8", "Cabildo 2040 PB A".
 *  3. Piso y letra pegados al final: "Cabildo 2040 3B", "Cabildo 2040 5° B".
 */
export function streetForSearch(address) {
  return String(address ?? '')
    .split(',')[0]
    .replace(/\s+(piso|p\.?b\.?|dto\.?|depto\.?|dpto\.?)(\s.*)?$/i, '')
    .replace(/\s+\d{1,2}°?\s?[A-Za-z]$/, '')
    .trim()
}

/**
 * Busca la dirección y devuelve `{ latitude, longitude }` del primer resultado,
 * o null si no la encuentra. Busca solo en Argentina.
 */
export async function geocodeAddress({ address, city, province }, { signal } = {}) {
  const params = new URLSearchParams({
    street: streetForSearch(address),
    city: city ?? '',
    state: province ?? '',
    country: 'Argentina',
    format: 'jsonv2',
    limit: '1',
  })

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    signal,
    headers: { 'Accept-Language': 'es' },
  })
  if (!response.ok) throw new Error(`El buscador de direcciones respondió ${response.status}.`)

  // La respuesta es una lista; con limit=1 trae a lo sumo un resultado.
  const [first] = await response.json()
  if (!first) return null
  return { latitude: Number(first.lat), longitude: Number(first.lon) }
}
