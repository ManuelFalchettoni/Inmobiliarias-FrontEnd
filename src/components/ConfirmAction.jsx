import { useEffect, useState } from 'react'
import { Button } from '@mantine/core'

const RESET_MS = 4000

/**
 * Acción destructiva en dos clics: el primero muestra "¿Borrar?" y el segundo
 * confirma. Si no se confirma en unos segundos, vuelve al estado inicial.
 * `children` recibe las props del disparador (`onClick`, `disabled`).
 */
export default function ConfirmAction({ label, onConfirm, disabled, children }) {
  // `armed` = "ya hicieron el primer clic, esperando confirmación".
  const [armed, setArmed] = useState(false)

  // Al armarse arranca un temporizador que lo desarma solo. La limpieza
  // (clearTimeout) evita que se dispare si se confirmó antes o se salió de la pantalla.
  useEffect(() => {
    if (!armed) return undefined
    const timer = setTimeout(() => setArmed(false), RESET_MS)
    return () => clearTimeout(timer)
  }, [armed])

  if (armed) {
    return (
      <Button
        size="compact-sm"
        color="red"
        disabled={disabled}
        onClick={() => {
          setArmed(false)
          onConfirm()
        }}
      >
        {label}
      </Button>
    )
  }

  // "Render prop": `children` es una función que recibe las props del botón y
  // devuelve cómo se ve (un tacho, un botón rojo...). Este componente solo
  // maneja la lógica de confirmar; cada pantalla decide el aspecto.
  return children({ onClick: () => setArmed(true), disabled })
}
