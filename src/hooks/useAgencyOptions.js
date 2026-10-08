import { useEffect, useState } from 'react'
import { listAgencies } from '../services/agencies.js'

/**
 * Agencias activas para un Select. El tope de página del backend es 100: si
 * algún día hay más, esto tiene que pasar a un Select con búsqueda remota.
 */
// Un "hook propio": una función que empieza con `use` y usa otros hooks
// (useState, useEffect). Saca la lógica de carga del componente para poder
// reutilizarla en varios formularios (propiedad, usuario, persona).
export function useAgencyOptions(currentId) {
  // `state` va de 'loading' a 'ready' o 'error'; la pantalla muestra
  // "Cargando agencias..." o el error según corresponda.
  const [result, setResult] = useState({ state: 'loading', options: [] })

  useEffect(() => {
    const controller = new AbortController()

    listAgencies({ size: 100, sort: 'publicName,asc', active: true }, { signal: controller.signal })
      .then((page) =>
        setResult({
          state: 'ready',
          // Cada agencia se convierte en { value, label }, el formato del Select.
          // El value va como texto porque el Select de Mantine trabaja con strings.
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
