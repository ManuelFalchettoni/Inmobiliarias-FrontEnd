import { createTheme } from '@mantine/core'

/**
 * Identidad visual de toda la app, en un solo lugar. Sale de la ficha de la
 * propiedad: el rótulo de un plano, con papel frío, tinta oscura, verde pino
 * y un acento bronce. Cambiar `primaryColor` cambia todos los botones, links y
 * badges que usan el color principal.
 *
 * Mantine pide cada color como 10 tonos, del más claro (0) al más oscuro (9).
 * Los botones rellenos usan el 6 en modo claro: ahí va el pino de la ficha.
 */
const pine = [
  '#e9f2f0',
  '#d2e4e1',
  '#a6c9c3',
  '#77ada5',
  '#50958c',
  '#33827a',
  '#0f5c55',
  '#0c4f49',
  '#09413c',
  '#06332f',
]

// El bronce del pin del mapa y de la foto activa: solo para acentos puntuales.
const brass = [
  '#f8f1e6',
  '#efe0c6',
  '#e2c693',
  '#d4aa63',
  '#c4933f',
  '#ba8939',
  '#b07d33',
  '#946828',
  '#78541f',
  '#5c4017',
]

/*
 * Colores con significado: se usan por nombre (`color="success"`), nunca por
 * tono, así se cambian acá y no en cada pantalla.
 * - success: algo salió bien o está vigente. Un verde hoja, más amarillo que
 *   el pino para no confundirse con el color principal.
 * - danger: errores, vencidos y acciones que borran. Un rojo ladrillo.
 */
const success = [
  '#eef6e9',
  '#dcecd2',
  '#b9d9a5',
  '#94c575',
  '#74b34d',
  '#5fa636',
  '#3f7f24',
  '#35701e',
  '#2a5a18',
  '#1f4311',
]

const danger = [
  '#fbecea',
  '#f4d3cf',
  '#e8a79f',
  '#dc7a6e',
  '#d15647',
  '#c94130',
  '#b23a2b',
  '#952f23',
  '#78251b',
  '#5b1b13',
]

// Archivo tiene un eje de ancho: el cuerpo va en ancho normal y los títulos
// angostos (ver index.css), así toda la app usa una sola familia.
const ARCHIVO = "'Archivo Variable', system-ui, sans-serif"

export const theme = createTheme({
  colors: { pine, brass, success, danger },
  primaryColor: 'pine',
  // La "tinta" de la ficha: el color del texto en vez del negro puro.
  black: '#17262a',
  // Bordes casi rectos, como la ficha: 4px en inputs y botones (`md`, el de
  // siempre) y 6px en las superficies (`lg`). `xl` queda en el valor de Mantine
  // porque es el que hace redondos los avatares y las barras de progreso.
  radius: { xs: '2px', sm: '3px', md: '4px', lg: '6px' },
  defaultRadius: 'md',
  fontFamily: ARCHIVO,
  headings: {
    fontFamily: ARCHIVO,
    fontWeight: '700',
    // `h2` es el tamaño de los títulos de página (`<Title order={1} size="h2">`):
    // grandes y apretados, como la dirección de la ficha.
    sizes: { h2: { fontSize: '38px', lineHeight: '1' } },
  },
})
