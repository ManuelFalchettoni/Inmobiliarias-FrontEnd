import { useEffect, useState } from 'react'
import { Button } from '@mantine/core'

const RESET_MS = 4000

/**
 * Acción destructiva en dos clics: el primero muestra "¿Borrar?" y el segundo
 * confirma. Si no se confirma en unos segundos, vuelve al estado inicial.
 * `children` recibe las props del disparador (`onClick`, `disabled`).
 */
export default function ConfirmAction({ label, onConfirm, disabled, children }) {
  const [armed, setArmed] = useState(false)

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

  return children({ onClick: () => setArmed(true), disabled })
}
