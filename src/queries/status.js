/**
 * Traduce el estado de una consulta de React Query al formato que usan los
 * Select del proyecto: `{ state: 'loading' | 'error' | 'ready', message }`.
 * Así los formularios no dependen de los nombres de React Query.
 */
export function selectState(query) {
  if (query.isPending) return { state: 'loading' }
  if (query.isError) return { state: 'error', message: query.error.message }
  return { state: 'ready' }
}
