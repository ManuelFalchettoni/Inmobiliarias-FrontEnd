# Inmobiliarias – FrontEnd

Panel web para gestionar inmobiliarias, sus propiedades (con fotos) y los usuarios de la plataforma.
Es la parte visual del sistema: todo lo que se guarda lo guarda el
[backend](https://github.com/ManuelFalchettoni/Inmobiliarias-BackEnd) (Spring Boot + MySQL + MinIO).

Este documento explica **cómo levantar el proyecto** y **cómo funciona por dentro**, con lenguaje
simple, para poder estudiarlo.

---

## 1. Cómo levantarlo

Hace falta tener corriendo:

- **Node.js** 20.19 o más nuevo.
- **El backend** en `http://localhost:8080`.
- **Docker con MinIO** (donde se guardan las fotos): `docker compose up -d` en la carpeta del backend.

```bash
npm install
npm run dev            # abre en http://localhost:5173
```

| Comando           | Para qué sirve                                  |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Levanta el proyecto para trabajar               |
| `npm run build`   | Genera la versión final en la carpeta `dist/`   |
| `npm run preview` | Sirve esa versión final para probarla           |
| `npm run lint`    | Revisa el código en busca de errores comunes    |

> **Ojo con el puerto.** El backend solo acepta pedidos que vengan de `localhost:5173` (o `3000`).
> Si ese puerto está ocupado, Vite arranca en `5174` y aparece el error *"No se pudo conectar con el
> servidor"*. Solución: cerrar lo que ocupa el `5173` y volver a correr `npm run dev`.

### Prueba rápida

1. **Crear una agencia** en `/dashboard/agencias/nueva`. CUIT de prueba válido: `30-71234567-1`.
2. **Publicar una propiedad** en `/dashboard/propiedades/nueva`: completar los datos, elegir la
   agencia y arrastrar algunas fotos.
3. Verla en el **listado** (`/dashboard/propiedades`) y editarla con el lápiz.
4. **Registrar un usuario** en `/registro`.

---

## 2. Qué hace hoy y qué falta

**Funciona**

- Registro de usuarios (`/registro`) y alta de usuarios con rol desde el panel.
- Alta de agencias.
- Propiedades: listado con páginas y filtro de publicadas / dadas de baja, alta y edición.
- Fotos: subir varias arrastrándolas, ver la portada en el listado y borrarlas.

**Todavía no**

- **Iniciar sesión.** La pantalla existe, pero el backend todavía no tiene cómo validar una contraseña
  ni recordar quién entró.
- **Que cada inmobiliaria vea solo lo suyo.** Hoy el panel funciona como el de un administrador
  general: ve y elige entre todas las agencias. Para que cada inmobiliaria gestione solo sus
  propiedades hace falta primero el login y vincular cada usuario con su agencia.
- Mapa, consultas de clientes y estadísticas (en el menú figuran como "Pronto").

---

## 3. Cómo está organizado

El código está dividido en **capas**, como un restaurante:

```
Páginas     →  el salón: lo que ve y toca el usuario (formularios, tablas)
Servicios   →  el mozo: sabe qué pedir y cómo tiene que ir cada pedido
api.js      →  la cocina: el único que habla con el backend
```

Cada capa solo habla con la de abajo. Una pantalla **nunca** llama al backend directamente: le pide
al servicio, y el servicio usa `api.js`. Así, si cambia algo del backend, se corrige en un solo lugar.

```
src/
├── services/      La comunicación con el backend
│   ├── api.js         Envía los pedidos y traduce los errores
│   ├── properties.js  Todo lo de propiedades y fotos
│   ├── agencies.js    Todo lo de agencias
│   └── users.js       Todo lo de usuarios
├── pages/         Las pantallas
│   ├── auth/          Login y registro
│   └── dashboard/     El panel: property/, agency/, user/
├── layouts/       El "marco" de las pantallas y el menú lateral
└── context/       Espacio preparado para la sesión (todavía sin uso real)
```

Herramientas principales:

- **React**: arma la interfaz con piezas reutilizables llamadas *componentes*.
- **Vite**: levanta el proyecto y lo actualiza al instante cuando se guarda un archivo.
- **Mantine**: biblioteca de componentes ya hechos (inputs, botones, tablas, zona para soltar fotos).
- **React Router**: decide qué pantalla mostrar según la dirección (`/registro`, `/dashboard/...`).

---

## 4. Recorrido de una acción: publicar una propiedad

Lo que pasa desde que se completa el formulario hasta que la propiedad queda guardada:

1. **Se revisan los datos en el navegador.** Si falta la dirección o la superficie es 0, el error
   aparece debajo del campo sin consultar al servidor. Las reglas son las mismas que tiene el backend
   (por ejemplo, dirección de hasta 150 caracteres o año entre 1800 y 2100).
2. **Se preparan los datos.** El formulario tiene los valores "a su manera" (textos, números vacíos).
   Antes de enviarlos se convierten al formato exacto que espera el backend, y se manda **solo lo que
   pide**, porque si llega un dato de más lo rechaza.
3. **Se crea la propiedad.** El backend responde con el número (id) de la propiedad nueva.
4. **Se suben las fotos, de a una**, usando ese número. Van de a una a propósito: el backend
   guarda cada envío como "todo o nada", así que si se mandaran juntas y una fallara se perderían
   todas. De a una, solo falla la mala, que queda marcada en rojo para quitarla o reintentar.
5. **Se pasa a la pantalla de edición** con el aviso "Propiedad publicada". Así, si se recarga la
   página, la propiedad no se crea dos veces.

¿Dónde quedan las fotos? En **MinIO**, un "disco" para archivos que corre en Docker. La base de datos
solo guarda el nombre del archivo, y el backend arma la dirección para verla.

---

## 5. Ideas clave 

**Validar en los dos lados.** El navegador valida por **comodidad**: el usuario ve el error al
instante. El backend valida por **seguridad**: cualquiera podría saltearse la página y hablarle
directo a la API. Una no reemplaza a la otra.

**Los errores del servidor se muestran en el campo correcto.** Si el backend responde "ese email ya
está registrado", el mensaje aparece debajo del campo *Email* y no como un cartel genérico. Si el
error es interno del servidor, se muestra un mensaje amable en lugar del detalle técnico.

**Traducir del sistema al usuario.** El backend habla en inglés y en códigos (`APARTMENT`,
`TENANT_OCCUPIED`). El front guarda una tabla de traducción (`Departamento`, `Con inquilino`) y
siempre envía el código original.

**Cancelar lo que ya no sirve.** Si el usuario sale de una pantalla mientras algo se está cargando o
subiendo, ese pedido se cancela. Así no se gasta conexión ni queda código queriendo actualizar una
pantalla que ya no existe.

**Vista previa de las fotos.** Antes de subirlas, el navegador crea una dirección temporal para
mostrar cada imagen. Cuando ya no hace falta, se libera para no ocupar memoria.

**Borrado lógico.** "Dar de baja" una propiedad, agencia o usuario no lo borra: lo marca como
inactivo, y se puede restaurar. Las fotos, en cambio, sí se borran para siempre.

**CORS.** Por seguridad, el navegador no deja que una página hable con un servidor de otra
"dirección" (otro puerto cuenta como otra dirección) salvo que ese servidor lo permita. Por eso
importa el puerto `5173`.

---

## 6. Dónde está cada cosa

| Quiero ver…                                   | Archivo                                           |
| --------------------------------------------- | ------------------------------------------------- |
| Cómo se envían los pedidos y se leen errores  | `src/services/api.js`                             |
| Tipos de propiedad, límites y reglas de fotos | `src/services/properties.js`                      |
| Reglas del formulario de propiedad            | `src/pages/dashboard/property/property-form.js`   |
| La pantalla de publicar / editar propiedad    | `src/pages/dashboard/property/PropertyForm.jsx`   |
| La zona de fotos                              | `src/pages/dashboard/property/PropertyPhotos.jsx` |
| El listado de propiedades                     | `src/pages/dashboard/property/PropertyList.jsx`   |
| Registro público                              | `src/pages/auth/Register.jsx`                     |
| Reglas de los formularios de usuario          | `src/pages/auth/user-form.js`                     |
| Alta de usuario desde el panel                | `src/pages/dashboard/user/UserForm.jsx`           |
| Alta de agencia                               | `src/pages/dashboard/agency/AgencyForm.jsx`       |
| Menú lateral y rutas del panel                | `src/layouts/dashboard-nav.js`, `src/pages/dashboard/DashboardRoutes.jsx` |

---

## 7. Preguntas frecuentes

**¿Por qué primero se crea la propiedad y después las fotos?**
Porque cada foto se guarda "dentro" de una propiedad, y para eso hace falta su número, que recién
existe cuando el backend la crea.

**¿Qué pasa si falla una foto?**
La propiedad y las demás fotos quedan guardadas. Solo la que falló queda marcada, con el motivo.

**¿Por qué no se puede cambiar la agencia al editar una propiedad?**
Porque el backend no permite mover una propiedad de una inmobiliaria a otra: si se intenta, lo
rechaza.

**¿Por qué el registro público no deja elegir el rol?**
Para que nadie pueda registrarse como administrador. Siempre se crea como usuario común.

**¿Qué formatos de foto se aceptan?**
JPG, PNG y WEBP, de hasta 5 MB cada una y hasta 20 por propiedad. Son los mismos límites del backend.


