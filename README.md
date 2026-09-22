# Inmobiliarias – FrontEnd

Panel de gestión inmobiliaria hecho con React 19, Vite y Mantine. Consume la API de [Inmobiliarias-BackEnd](https://github.com/ManuelFalchettoni/Inmobiliarias-BackEnd) (Spring Boot).

## Requisitos

- Node.js 20.19+ (lo exige Vite 8)
- El backend corriendo (por defecto en `http://localhost:8080`)

## Puesta en marcha

```bash
npm install
cp .env.example .env   # opcional: ajustar VITE_API_URL
npm run dev            # http://localhost:5173
```

| Script            | Descripción                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Servidor de desarrollo       |
| `npm run build`   | Build de producción (`dist/`) |
| `npm run preview` | Sirve el build localmente    |
| `npm run lint`    | ESLint                       |

## Funcionalidades

- Login y registro de usuarios
- Propiedades: listado paginado, alta, edición y fotos
- Alta de agencias y usuarios
- Secciones en desarrollo: mapa, leads y analítica

## Estructura

```
src/
├── context/    # Autenticación
├── layouts/    # AuthLayout, DashboardLayout y menú (dashboard-nav.js)
├── pages/      # auth/ y dashboard/ (property, agency, user)
└── services/   # Cliente HTTP (api.js) y servicios por recurso
```
