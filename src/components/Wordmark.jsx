import { Group, Text } from '@mantine/core'

/**
 * El nombre de la app. Cambiarlo acá lo cambia en el encabezado y en el login;
 * el título de la pestaña está aparte, en el `<title>` de index.html.
 */
export const APP_NAME = 'Zaguán'

/**
 * Logotipo: el isotipo (la Z con el umbral bronce del favicon) y el nombre en Archivo
 * angosto, como los títulos. `size` es la altura del isotipo en px; el texto
 * acompaña esa medida.
 */
export default function Wordmark({ size = 32 }) {
  return (
    <Group gap={size * 0.3} wrap="nowrap">
      <img src="/favicon.svg" width={size} height={size} alt="" />
      <Text
        component="span"
        ff="heading"
        fw={750}
        fz={size * 0.85}
        lh={1}
        c="var(--app-ink)"
        style={{ fontStretch: '72%', letterSpacing: '-0.01em' }}
      >
        {APP_NAME}
      </Text>
    </Group>
  )
}
