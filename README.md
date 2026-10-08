# Inmobiliarias – FrontEnd

Panel web de administración de la plataforma de inmobiliarias. Consume la API del
[backend](https://github.com/ManuelFalchettoni/Inmobiliarias-BackEnd) (Spring Boot + MySQL + MinIO).

React 19 · Vite · Mantine 9 · React Router 7 · TanStack Query 5.

## Levantarlo

Requisitos: Node.js 20.19 o superior y el backend corriendo en `http://localhost:8080`.

```bash
npm install
npm run dev
```

| Comando           | Qué hace                              |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Servidor de desarrollo en el `5173`   |
| `npm run build`   | Build de producción en `dist/`        |
| `npm run preview` | Sirve el build                        |
| `npm run lint`    | ESLint                                |

La URL del backend se configura con `VITE_API_URL` (ver `.env.example`). El CORS del backend solo
acepta `localhost:5173` y `localhost:3000`: si Vite arranca en otro puerto, los pedidos fallan.

## Pantallas

| Ruta                                | Pantalla                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| `/registro`                         | Registro público (`POST /api/auth/register`)                        |
| `/login`                            | Formulario de login (sin conexión al backend)                       |
| `/dashboard/propiedades`            | Listado de propiedades, activas o dadas de baja                     |
| `/dashboard/propiedades/nueva`      | Alta de propiedad con precios y fotos                               |
| `/dashboard/propiedades/:id/editar` | Edición de propiedad: datos, precios, dueños y fotos                |
| `/dashboard/agencias`               | Listado de agencias: estado de verificación, baja y restauración    |
| `/dashboard/agencias/nueva`         | Alta de agencia, con borrador local                                 |
| `/dashboard/agencias/:id/editar`    | Edición de agencia                                                  |
| `/dashboard/usuarios`               | Listado de usuarios, filtrable por agencia                          |
| `/dashboard/usuarios/nuevo`         | Alta de usuario con rol, agencia, CUIT y matrícula                  |
| `/dashboard/usuarios/:id/editar`    | Edición de usuario y cambio de contraseña                           |
| `/dashboard/personas`               | Listado, alta y edición de personas (clientes y propietarios)       |
| `/dashboard/contratos`              | Listado de contratos de venta y alquiler                            |
| `/dashboard/contratos/:id`          | Detalle del contrato y sus partes                                   |
| `/dashboard/consultas`              | Leads del CRM, filtrables por agente                                |
| `/dashboard/consultas/:id`          | Lead: etapa, historial, ofertas y recordatorios                     |

Archivados, Explorador & Mapa, Analítica & Reportes y Configuración muestran una pantalla
"Próximamente".

## Estructura

```
src/
├── services/     Un módulo por recurso del backend. Única capa que hace pedidos HTTP.
│   ├── api.js        fetch, timeout, cancelación y errores (ApiError)
│   ├── format.js     Fechas
│   └── agencies, users, properties, people, owners, contracts, crm, workspace
├── queries/      React Query: cliente (client.js) y claves de caché (keys.js)
├── hooks/        useAgencyOptions, useSelectOptions (opciones de Select), useLookup (ids a registros)
├── components/   Componentes compartidos (ConfirmAction)
├── layouts/      AuthLayout, DashboardLayout y el menú (dashboard-nav.js)
├── pages/
│   ├── auth/         Login, registro y reglas de usuario
│   └── dashboard/    agency/, user/, property/, people/, contract/, crm/ y DashboardRoutes.jsx
└── context/      AuthContext de demostración (no está montado)
```

## Convenciones

- **Servicios = DTOs.** Cada servicio replica los `Request`/`Response`, enums y límites (`@Size`,
  `@Digits`) del backend. Las funciones `toXRequest` arman el body exacto: el backend rechaza con
  400 cualquier campo desconocido.
- **Formularios.** Mantine Form en modo no controlado. Las reglas viven en un `*-form.js` junto a la
  pantalla y reproducen las del backend. Los errores 400 y 409 se muestran en el campo que los causó.
- **Lecturas con React Query.** Toda lectura del backend es un `useQuery` con una clave de
  `queries/keys.js` (`['properties', 'list', params]`, `['properties', 'detail', 7]`). Los datos
  quedan en una caché compartida, frescos por 30 s. Solo se reintenta una vez, ante errores de red o 5xx.
- **Escrituras.** Después de crear, editar o borrar se invalida la clave del recurso
  (`invalidateQueries({ queryKey: ['properties'] })`): se refrescan listados, detalles y el total
  del menú. Las acciones de las filas usan `useMutation`.
- **Listados.** Página y filtros en la URL (`?page=2&active=false`). La página se muestra desde 1 y se
  pide desde 0. Mientras llega una página se muestra la anterior (`keepPreviousData`).
- **Ids a nombres.** Las respuestas del CRM, contratos y dueños traen solo ids; `useLookup` los
  resuelve con la misma clave que el detalle, así cada registro se pide una sola vez.

## Limitaciones actuales

- No hay login: el backend no lo expone, y el panel accede a los datos de todas las agencias.
- `/api/people`, `/api/property_contracts`, `/api/contract_parties` y `/api/property_owners` no
  filtran ni ordenan. Partes y dueños se traen completos y se filtran en el cliente.
- La barra superior (búsqueda, notificaciones y nombre de la agencia) es estática.
