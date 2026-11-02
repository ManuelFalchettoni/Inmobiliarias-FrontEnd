import { useState } from 'react'
import { Box, Text } from '@mantine/core'

/**
 * "Habitat Prime S.R.L." -> "HP"; "Zaguán" -> "ZA". Se toman las iniciales de
 * las dos primeras palabras; con una sola palabra, sus dos primeras letras.
 */
function agencyInitials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]
  return letters.toUpperCase()
}

/**
 * El logo de una inmobiliaria en un cuadrado de `size` px.
 *
 * - Con `src`: la imagen entera dentro del cuadrado (`object-fit: contain`),
 *   sin recortarla ni deformarla, sobre un fondo neutro. Muchos logos son PNG
 *   con fondo transparente y así se ven igual en cualquier pantalla.
 * - Sin `src` (la agencia no tiene logo) o si la imagen no carga: las
 *   iniciales del nombre.
 */
export default function AgencyLogo({ src, name, size = 40, radius = 'md' }) {
  // Guarda QUÉ dirección falló, no un simple true/false: si después llega
  // otro `src` (se subió un logo nuevo), ya no coincide y se vuelve a intentar.
  const [failedSrc, setFailedSrc] = useState(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <Box
      w={size}
      h={size}
      // `flex: none`: en una fila (Group) el cuadrado no se achica si falta lugar.
      style={{
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        borderRadius: `var(--mantine-radius-${radius})`,
        border: '1px solid var(--app-line)',
        background: showImage ? 'var(--app-raised)' : 'var(--mantine-color-pine-light)',
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ? `Logo de ${name}` : 'Logo de la inmobiliaria'}
          // Un pequeño margen interno para que el logo no toque el borde.
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size * 0.08 }}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Text component="span" fw={700} fz={size * 0.38} lh={1} c="var(--mantine-color-pine-light-color)" aria-hidden>
          {agencyInitials(name)}
        </Text>
      )}
    </Box>
  )
}
