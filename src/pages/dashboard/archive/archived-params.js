const PAGE_SIZE = 10

/**
 * Los parámetros del pedido de una página de dados de baja. Los usan la tabla de
 * cada sección (ArchivedSection) y los contadores del selector (ArchiveList):
 * con la misma clave, la primera página se pide una sola vez y la comparten.
 * Lo más reciente primero: lo último que se dio de baja queda arriba.
 */
export const archivedParams = (page) => ({ page, size: PAGE_SIZE, sort: 'updatedAt,desc', active: false })
