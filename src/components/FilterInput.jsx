import { useState } from 'react'
import { NumberInput, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'

/**
 * Campo de texto o número de un filtro de listado. Avisa el cambio recién
 * cuando el usuario deja de tipear (`delay`), así "cordoba" es un pedido al
 * backend y no siete.
 *
 * `value` es el valor de la URL y `onChange` recibe el texto ya recortado.
 */
export default function FilterInput({ value, onChange, number = false, delay = 400, ...props }) {
  // Lo que se ve en el campo, que va adelante de la URL mientras se tipea.
  const [text, setText] = useState(value)
  // El último valor de la URL que vio el campo y el último que mandó él.
  const [synced, setSynced] = useState(value)
  const [sent, setSent] = useState(value)

  // Si la URL cambia por otro lado ("Limpiar filtros", el botón atrás), el campo
  // la copia; si es la que mandó él, no, porque el usuario pudo seguir tipeando.
  // Es el patrón de React para ajustar un estado cuando cambia una prop.
  if (value !== synced) {
    setSynced(value)
    if (value !== sent) setText(value)
  }

  const commit = useDebouncedCallback((next) => {
    setSent(next)
    onChange(next)
  }, delay)

  const handleChange = (next) => {
    setText(next)
    commit(String(next).trim())
  }

  if (number) {
    // NumberInput entrega un número, o '' si el campo quedó vacío.
    return <NumberInput value={text} onChange={handleChange} hideControls {...props} />
  }

  return <TextInput value={text} onChange={(event) => handleChange(event.currentTarget.value)} {...props} />
}
