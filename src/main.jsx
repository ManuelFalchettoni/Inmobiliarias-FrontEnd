/**
 * Punto de entrada de la aplicación.
 *
 * El `index.html` tiene un `<div id="root">` vacío: React lo toma y dibuja
 * toda la aplicación adentro. Cada componente que envuelve a `<App />` le da
 * algo a todo lo que está adentro (ver los comentarios del render).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { QueryClientProvider } from '@tanstack/react-query'

// Los estilos se importan una sola vez, acá: los de Mantine, los de la zona
// para soltar fotos (Dropzone) y los propios de la app.
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import './index.css'

import App from './App.jsx'
import { queryClient } from './queries/client.js'
import { theme } from './theme.js'

createRoot(document.getElementById('root')).render(
  // StrictMode: modo de revisión, solo en desarrollo. Monta, desmonta y vuelve
  // a montar cada componente para detectar efectos que no limpian bien. Por eso
  // en desarrollo algunos pedidos al backend salen dos veces (el primero se cancela).
  // MantineProvider: aplica el tema (color, bordes, tipografía) a todos los componentes.
  // BrowserRouter: permite cambiar de pantalla según la dirección sin recargar la página.
  // QueryClientProvider: comparte la caché de React Query con toda la app.
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
)
