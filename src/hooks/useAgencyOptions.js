import { useEffect, useState } from 'react'
import { listAgencies } from '../services/agencies.js'

/**
 * Agencias activas para un Select. El tope de página del backend es 100: si
 * algún día hay más, esto tiene que pasar a un Select con búsqueda remota.
 */
export function useAgencyOptions(currentId) {
  const [result, setResult] = useState({ state: 'loading', options: [] })

  useEffect(() => {
    const controller = new AbortController()

    listAgencies({ size: 100, sort: 'publicName,asc', active: true }, { signal: controller.signal })
      .then((page) =>
        setResult({
          state: 'ready',
          options: page.content.map((agency) => ({
            value: String(agency.id),
            label: `${agency.publicName} (#${agency.id})`,
          })),
        }),
      )
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ state: 'error', message: error.message, options: [] })
      })

    return () => controller.abort()
  }, [])

  // Un registro cuya agencia ya no está activa igual tiene que mostrar su valor.
  const missing = currentId && !result.options.some((option) => option.value === currentId)
  const options = missing ? [{ value: currentId, label: `Agencia #${currentId}` }, ...result.options] : result.options

  return { ...result, options }
}
