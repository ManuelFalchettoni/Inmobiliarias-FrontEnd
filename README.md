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
acepta `localhost:5173`, `localhost:5174` y `localhost:3000`: si Vite arranca en otro puerto, los
pedidos fallan.

## Sesión y roles

Toda la API pide login, salvo `/api/auth/**`. El login deja el JWT en una cookie HttpOnly (`token`)
que el front no lee ni guarda: `api.js` llama siempre con `credentials: 'include'` y el navegador la
manda sola.

- **Quién está logueado.** `AuthContext` guarda el usuario (`id`, `name`, `email`, `rol`,
  `agencyId`) solo en memoria. Al abrir o recargar la app pregunta `GET /api/users/me`: con 200
  sigue la sesión, con 401 se entra por el login. Mientras tanto, el panel muestra un spinner.
- **Login.** `POST /api/auth/login` trae `id`, `name`, `email` y `rol`; enseguida se pide `/me`
  para sumar el `agencyId`. Después vuelve a la pantalla a la que se quería entrar.
- **Logout.** `POST /api/auth/logout` borra la cookie; después se limpian el usuario y la caché.
- **401.** Cualquier pedido con sesión que responde 401 limpia la sesión y la caché, y manda al
  login con el aviso "Tu sesión venció".
- **403.** El error dice "No tenés permiso..." y queda en la pantalla. Las rutas de otro rol ni se
  montan: `RoleGate` muestra "Sin permiso".

| Rol | Ve |
| --- | --- |
| `ADMIN` | Todo. Es el único con Agencias (listar, crear, dar de baja, restaurar) y con el selector de inmobiliaria en los listados. |
| `AGENCY`, `AGENT` | Solo lo de su inmobiliaria. Las altas cargan su `agencyId` con el Select bloqueado. Pueden editar los datos de su inmobiliaria desde Configuración, salvo el estado de verificación. |
| `USER` | Solo Configuración (el que se registra solo, hasta que una inmobiliaria lo sume). |

## Pantallas

| Ruta                                | Pantalla                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| `/registro`                         | Registro público (`POST /api/auth/register`)                        |
| `/login`                            | Login (`POST /api/auth/login`); con sesión vigente, entra directo al panel |
| `/propiedades/:id`                  | Ficha de la propiedad para mostrarle a un cliente: fotos, datos, precio, mapa y contacto. Fuera del panel y sin edición |
| `/dashboard/propiedades`            | Listado de propiedades, activas o dadas de baja, con búsqueda por filtros |
| `/dashboard/propiedades/nueva`      | Alta de propiedad con precios y fotos                               |
| `/dashboard/propiedades/:id/editar` | Edición de propiedad: datos, precios, dueños y fotos                |
| `/dashboard/agencias`               | Listado de agencias: estado de verificación, baja y restauración (solo admin) |
| `/dashboard/agencias/nueva`         | Alta de agencia, con borrador local (solo admin)                    |
| `/dashboard/agencias/:id/editar`    | Edición de agencia (los demás roles, solo la suya)                  |
| `/dashboard/usuarios`               | Listado de usuarios, filtrable por agencia (el admin)               |
| `/dashboard/usuarios/nuevo`         | Alta de usuario con rol, agencia, CUIT y matrícula                  |
| `/dashboard/usuarios/:id/editar`    | Edición de usuario y cambio de contraseña                           |
| `/dashboard/personas`               | Personas (clientes y propietarios), con búsqueda por nombre, DNI, CUIT y contacto |
| `/dashboard/contratos`              | Contratos de venta y alquiler, filtrables por propiedad, estado, fechas y monto |
| `/dashboard/contratos/:id`          | Detalle del contrato y sus partes                                   |
| `/dashboard/consultas`              | Leads del CRM, filtrables por agente                                |
| `/dashboard/consultas/:id`          | Lead: etapa, historial, ofertas y recordatorios                     |
| `/dashboard/avisos`                  | Agenda: leads ordenados por el tiempo que falta para su próximo aviso pendiente |
| `/dashboard/configuracion`          | Cuenta propia (`/api/users/me`): datos, contraseña e inmobiliaria. La única pantalla de un USER |

Archivados, Explorador & Mapa y Analítica & Reportes muestran una pantalla
"Próximamente".

Una dirección que no existe muestra la página 404 (`components/NotFound.jsx`): dentro del panel con
el menú, y fuera de él a pantalla completa. Lo mismo un registro que el backend responde con 404
(`/dashboard/propiedades/999/editar`, `/dashboard/consultas/999`...), con un texto según el recurso
y un botón para volver a su listado. Los demás errores siguen mostrando el cartel rojo.

## Estructura

```
src/
├── services/     Un módulo por recurso del backend. Única capa que hace pedidos HTTP.
│   ├── api.js        fetch, timeout, cancelación y errores (ApiError)
│   ├── format.js     Fechas
│   └── auth, agencies, users, properties, people, owners, contracts, crm, workspace
├── queries/      React Query: cliente (client.js) y claves de caché (keys.js)
├── hooks/        useAgencyOptions, useSelectOptions (opciones de Select), useLookup (ids a registros),
│                 useUrlFilters (página y filtros en la URL), useNow (hora que avanza cada minuto)
├── components/   Componentes compartidos (ConfirmAction, FilterInput, RoleGate, NotFound)
├── layouts/      AuthLayout, DashboardLayout, el menú (dashboard-nav.js) y la barra superior:
│                 HeaderSearch (buscador) y AlertBell (campanita de avisos)
├── pages/
│   ├── auth/         Login, registro y reglas de usuario
│   └── dashboard/    account/, agency/, user/, property/, people/, contract/, crm/ y DashboardRoutes.jsx
└── context/      AuthContext: el usuario que inició sesión (`useAuth()`)
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
- **Búsqueda.** Personas y contratos usan siempre `GET .../search` (todos los filtros son
  opcionales); propiedades pasa a `/search` en cuanto hay un filtro. El texto no distingue
  mayúsculas ni acentos. Los campos de texto (`FilterInput`) escriben en la URL 400 ms después de la
  última tecla, así no se pide una vez por letra. La búsqueda de propiedades solo trae publicadas:
  con "Dadas de baja" no se filtra.
- **`agencyId`.** Solo lo manda el admin, en listados y búsquedas (sin él ve todas). Para AGENCY y
  AGENT el backend usa el de la sesión, así que el front ni lo manda; en las altas va el suyo porque
  la validación lo pide. Algo de otra inmobiliaria responde 404, como si no existiera.
- **Ids a nombres.** Las respuestas del CRM, contratos y dueños traen solo ids; `useLookup` los
  resuelve con la misma clave que el detalle, así cada registro se pide una sola vez.
- **Barra superior.** El buscador busca a la vez personas por nombre y propiedades por ciudad
  (el backend no busca propiedades por dirección) y lleva a la ficha o al listado filtrado. La
  campanita usa `GET /api/crm_alerts/upcoming`: un agente ve sus avisos; la inmobiliaria y el admin,
  los de todos. Se refresca cada minuto, se pone roja si hay vencidos y deja marcarlos como
  cumplidos. Un USER no ve ninguno de los dos.

## Limitaciones actuales

- `/api/contract_parties` y `/api/property_owners` no filtran ni ordenan: partes y dueños se traen
  completos y se filtran en el cliente.
- La agenda de avisos trae todos los leads (de a 100), hace un `GET .../alerts` por lead y ordena
  en el navegador. `GET /api/crm_alerts/upcoming` hoy lo usa solo la campanita.
