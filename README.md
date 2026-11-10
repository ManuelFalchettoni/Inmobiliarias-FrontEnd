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
  para sumar el `agencyId`. Después vuelve a la pantalla a la que se quería entrar; si se viene de
  un logout, al inicio, no a la última pantalla del usuario anterior.
- **Logout.** `POST /api/auth/logout` borra la cookie; después se limpian el usuario y la caché.
- **Olvidé mi contraseña.** El modal del login pide el email (`POST /api/auth/password/forgot`,
  siempre 204, exista la cuenta o no) y el backend manda un mail con un link a
  `/restablecer-contrasena?token=...`. Ahí se elige la nueva (`POST /api/auth/password/reset`) y se
  vuelve al login. El link dura una hora y sirve una vez; vencido o usado, da 400 y se ofrece pedir otro.
- **401.** Cualquier pedido con sesión que responde 401 limpia la sesión y la caché, y manda al
  login con el aviso "Tu sesión venció".
- **403.** El error dice "No tenés permiso..." y queda en la pantalla. Las rutas de otro rol ni se
  montan: `RoleGate` muestra "Sin permiso".

| Rol | Ve |
| --- | --- |
| `ADMIN` | Todo. Es el único con Agencias (listar, crear, dar de baja, restaurar) y con el selector de inmobiliaria en los listados. |
| `AGENCY`, `AGENT` | Solo lo de su inmobiliaria. Las altas cargan su `agencyId` con el Select bloqueado. Pueden editar los datos de su inmobiliaria desde Configuración, salvo el estado de verificación. Un `AGENT` ve los usuarios pero no los crea, edita ni restaura. |
| `USER` | Solo Configuración (el que se registra solo, hasta que una inmobiliaria lo sume). |

## Pantallas

| Ruta                                | Pantalla                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| `/`, `/dashboard`                   | Redirigen al inicio: Propiedades, o Configuración para un USER      |
| `/registro`                         | Registro público (`POST /api/auth/register`)                        |
| `/login`                            | Login (`POST /api/auth/login`); con sesión vigente, entra directo al panel |
| `/restablecer-contrasena`           | Contraseña nueva con el token del mail de recuperación (`POST /api/auth/password/reset`) |
| `/propiedades/:id`                  | Ficha de la propiedad para mostrarle a un cliente: fotos, datos, precio, mapa y contacto. Fuera del panel y sin edición |
| `/dashboard/propiedades`            | Listado de propiedades, activas o archivadas, en fichas, tabla (`?vista=tabla`) o mapa (`?vista=mapa`), con panel de filtros y orden |
| `/dashboard/propiedades/nueva`      | Alta de propiedad con precios y fotos                               |
| `/dashboard/propiedades/:id/editar` | Edición de propiedad: datos, precios, dueños, fotos y archivar      |
| `/dashboard/agencias`               | Listado de agencias: estado de verificación, baja y restauración (solo admin) |
| `/dashboard/agencias/nueva`         | Alta de agencia, con borrador local (solo admin)                    |
| `/dashboard/agencias/:id/editar`    | Edición de agencia (los demás roles, solo la suya), con subir, cambiar o quitar el logo |
| `/dashboard/usuarios`               | Listado de usuarios, filtrable por agencia (el admin)               |
| `/dashboard/usuarios/nuevo`         | Alta de usuario con rol, agencia, CUIT y matrícula (admin e inmobiliaria) |
| `/dashboard/usuarios/:id/editar`    | Edición de usuario y cambio de contraseña (admin e inmobiliaria)    |
| `/dashboard/personas`               | Personas (clientes y propietarios), con búsqueda por nombre, DNI, CUIT y contacto |
| `/dashboard/personas/nueva`         | Alta de persona                                                     |
| `/dashboard/personas/:id/editar`    | Edición de persona                                                  |
| `/dashboard/contratos`              | Contratos de venta y alquiler, filtrables por propiedad, estado, fechas y monto. Sin elegir estado, solo los vigentes |
| `/dashboard/contratos/nuevo`        | Alta de contrato                                                    |
| `/dashboard/contratos/:id`          | Detalle del contrato y sus partes; como Propietario solo se ofrecen los dueños de la propiedad |
| `/dashboard/contratos/:id/editar`   | Edición de contrato                                                 |
| `/dashboard/consultas`              | Leads del CRM, filtrables por agente                                |
| `/dashboard/consultas/nuevo`        | Alta de lead                                                        |
| `/dashboard/consultas/:id`          | Lead: etapa, historial, ofertas (aceptar pide confirmación y cierra el lead) y recordatorios |
| `/dashboard/avisos`                 | Agenda (`GET /api/crm_alerts/agenda`): leads agrupados por el tramo de su próximo aviso, vencidos primero |
| `/dashboard/archivados`             | Propiedades, agencias (solo admin) y usuarios dados de baja, con Restaurar (usuarios: admin e inmobiliaria) |
| `/dashboard/analitica`              | Analítica (`GET /api/analytics/summary`): propiedades, leads, ofertas, contratos y rendimiento por agente; el admin elige inmobiliaria |
| `/dashboard/configuracion`          | Cuenta propia (`/api/users/me`): datos, contraseña e inmobiliaria. La única pantalla de un USER |

Los mapas usan Leaflet con OpenStreetMap: el de la ficha (`PropertyMap.jsx`) y la vista Mapa del
listado (`PropertyListMap.jsx`), que busca lo que hay en la zona visible.

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
│   └── auth, agencies, users, properties, people, owners, contracts, crm, analytics, workspace
├── queries/      React Query: cliente (client.js) y claves de caché (keys.js)
├── hooks/        useAgencyOptions, useSelectOptions (opciones de Select), useLookup (ids a registros),
│                 useUrlFilters (página y filtros en la URL), useNow (hora que avanza cada minuto)
├── components/   Componentes compartidos (AgencyLogo, ConfirmAction, FilterInput, FilterPanel,
│                 RoleGate, NotFound, Wordmark: logo y nombre de la app)
├── layouts/      AuthLayout, DashboardLayout, el menú lateral (DashboardNavbar, con los ítems en
│                 dashboard-nav.js) y la barra superior:
│                 HeaderSearch (buscador) y AlertBell (campanita de avisos)
├── pages/
│   ├── auth/         Login, registro, restablecer contraseña y reglas de usuario
│   └── dashboard/    account/, agency/, analytics/, archive/, user/, property/, people/, contract/,
│                     crm/ y DashboardRoutes.jsx
├── context/      AuthContext: el usuario que inició sesión (`useAuth()`)
└── theme.js      Tema de Mantine: colores, bordes y tipografía (Archivo)
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
- **Panel de filtros.** Propiedades, personas y contratos juntan sus filtros en un panel lateral
  (`FilterPanel.jsx`): el botón "Filtros" dice cuántos hay aplicados y cada filtro activo queda
  como un chip que se quita con un clic. Un rango inválido ("desde" mayor que "hasta") o un precio
  sin moneda se marca en el campo y no se manda. Ordenar propiedades por precio pide operación y
  moneda elegidas.
- **Búsqueda.** Personas y contratos usan siempre `GET .../search` (todos los filtros son
  opcionales); propiedades pasa a `/search` en cuanto hay un filtro. El texto no distingue
  mayúsculas ni acentos. Los campos de texto (`FilterInput`) escriben en la URL 400 ms después de la
  última tecla, así no se pide una vez por letra. La búsqueda de propiedades solo trae activas:
  con "Archivadas" no se filtra. Archivar (`PATCH /archive`) se hace solo desde la edición, que
  vuelve al listado con un aviso para deshacer; restaurar se hace desde la pestaña Archivadas. Con
  contratos vigentes o leads abiertos el backend responde 409 y se explica por qué no se puede. Una
  archivada no se abre por id (404), así que se muestra con los datos del listado.
- **Selects de personas.** No traen a todas: buscan por nombre en `/api/people/search` mientras se
  escribe y muestran las primeras 20.
- **`agencyId`.** Solo lo manda el admin, en listados y búsquedas (sin él ve todas). Para AGENCY y
  AGENT el backend usa el de la sesión, así que el front ni lo manda; en las altas va el suyo porque
  la validación lo pide. Algo de otra inmobiliaria responde 404, como si no existiera.
- **Ids a nombres.** Contratos y leads traen embebidas sus partes, personas y agente. Lo que todavía
  llega como id (dueños, usuarios del historial y de los avisos, agencias) lo resuelve `useLookup`
  con la misma clave que el detalle, así cada registro se pide una sola vez.
- **Barra superior.** El buscador busca a la vez personas por nombre y propiedades por dirección y
  por ciudad, y lleva a la ficha o al listado filtrado. Al llegar los resultados queda marcado el
  primero: Enter lo abre, y con las flechas se elige otro. La
  campanita usa `GET /api/crm_alerts/upcoming`: un agente ve sus avisos; la inmobiliaria y el admin,
  los de todos. Se refresca cada minuto, se pone roja si hay vencidos y deja marcarlos como
  cumplidos. Un USER no ve ninguno de los dos. AGENCY y AGENT ven además el logo y el nombre de su
  inmobiliaria (`agencyIconUrl` de `/api/users/me`); sin logo, sus iniciales.
- **Logo de la agencia.** Se sube o reemplaza con `PUT /api/agencies/{id}/icon` (multipart, parte
  `file`) y se quita con `DELETE` al mismo endpoint, al momento y aparte del "Guardar cambios".
  Antes de subir se valida formato (JPG, PNG o WEBP; SVG no) y tamaño (5 MB), y mientras sube se
  muestra la imagen elegida con `URL.createObjectURL`. Después se actualizan la agencia en caché y
  `users.me()`, así el encabezado cambia sin recargar.
- **Recordatorios por mail.** Los manda el backend, una vez por alerta, al agente de la alerta. El
  front no dispara nada: `alertEmailStatus` (`services/crm.js`) calcula el estado a partir de
  `notifiedAt` y `AlertEmailBadge` lo muestra en el lead, la agenda y la campanita (programado, por
  salir, enviado o no enviado).

## Limitaciones actuales

- `/api/property_owners` no filtra ni ordena: los dueños se traen completos y se filtran en el
  cliente.
- La anticipación del mail no se puede configurar desde el panel y el backend no la expone:
  `ALERT_EMAIL_HOURS` copia el default de `CRM_ALERT_REMINDER_HOURS` (24 h).
