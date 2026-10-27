import { useEffect, useState } from 'react'

/** Cada cuánto se recalcula el "falta": una vez por minuto alcanza. */
const CLOCK_TICK = 60 * 1000

/**
 * La hora actual, actualizada cada minuto: así el "falta" baja solo y un aviso
 * que se cumple cambia de estado sin recargar la página.
 */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK)
    return () => clearInterval(id)
  }, [])
  return now
}
