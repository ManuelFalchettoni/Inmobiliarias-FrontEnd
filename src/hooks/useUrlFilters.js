import { useSearchParams } from 'react-router-dom'

const hasValue = (value) => value != null && value !== ''

/**
 * Página y filtros de un listado, guardados en la URL (`?page=2&city=cordoba`).
 *
 * Las escrituras usan la forma con función de `setSearchParams`: parten de la
 * URL de ese momento y no de la del último render. Importa con los campos de
 * texto, que escriben medio segundo después de que el usuario dejó de tipear.
 */
export function useUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1) // 1-based, como lo ve el usuario

  /** Los filtros de la lista que tienen valor: `{ city: 'cordoba' }`. */
  const pick = (names) => {
    const filters = {}
    for (const name of names) {
      const value = searchParams.get(name)
      if (hasValue(value)) filters[name] = value
    }
    return filters
  }

  /**
   * Cambia un filtro y vuelve a la página 1, o queda una lista vacía. Un valor
   * vacío (un Select limpiado, un campo borrado) saca el filtro de la dirección.
   * `replace` evita llenar el historial del navegador mientras se tipea.
   */
  const setFilter = (name, value, { replace = false } = {}) =>
    setSearchParams(
      (current) => {
        // Se copian los parámetros actuales para no perder los otros filtros.
        const next = new URLSearchParams(current)
        if (hasValue(value)) next.set(name, String(value))
        else next.delete(name)
        next.delete('page')
        return next
      },
      { replace },
    )

  const clearFilters = (names) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const name of [...names, 'page']) next.delete(name)
      return next
    })

  const goToPage = (nuevaPagina) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', String(nuevaPagina))
      return next
    })

  return { searchParams, page, pick, setFilter, clearFilters, goToPage }
}
