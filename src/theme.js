import { createTheme } from '@mantine/core'

/**
 * Identidad visual de toda la app, en un solo lugar. Cambiar `primaryColor`
 * cambia todos los botones, links y badges que usan el color principal.
 */
export const theme = createTheme({
  primaryColor: 'teal', // verde azulado
  defaultRadius: 'md', // bordes redondeados medianos en inputs, botones y tarjetas
  // `system-ui` usa la fuente del sistema operativo: no se descarga ninguna
  // fuente, así la página carga más rápido.
  fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
})
