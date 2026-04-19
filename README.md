# Respell App

Base en Vue para la web de Respell con:

- landing page inspirada en la referencia entregada
- sección de servicios y testimonios
- catálogo inicial de cursos
- bloques preparados para gestión, publicación y ventas online
- persistencia de solicitudes de contacto en Turso Cloud

## Requisitos

Necesitas instalar Node.js 20+ en el equipo.

## Variables de entorno

Crea un archivo `.env` en la raíz con:

```bash
TURSO_URL=libsql://tu-db.turso.io
TURSO_TOKEN=tu-token-de-turso
PORT=3001
```

También tienes una base en [.env.example](/home/juan/Documentos/Dev/Proyectos/RespellApp/.env.example:1).

## Crear usuario administrador

Antes de probar el login, crea el primer usuario admin:

```bash
npm run create:admin -- admin@respell.com una-clave-segura
```

También puedes pasar un nombre:

```bash
npm run create:admin -- admin@respell.com una-clave-segura "Admin Respell"
```

## Migraciones

Las migraciones SQL viven en [migrations](/home/juan/Documentos/Dev/Proyectos/RespellApp/migrations/README.md:1) para mantener trazabilidad del esquema.

Para ejecutarlas con el runner del proyecto:

```bash
npm run migrate
```

También puedes usar el atajo shell:

```bash
sh scripts/run-migrations.sh
```

El runner registra en Turso qué archivos ya fueron aplicados en la tabla `schema_migrations`, así mantenemos trazabilidad real del historial.

## Instalar dependencias

```bash
npm install
```

## Ejecutar en desarrollo

En una terminal:

```bash
npm run dev
```

En otra terminal:

```bash
npm run dev:server
```

## Rutas de la app

- `/` sitio público y landing
- `/cursos` catálogo público de cursos publicados
- `/cursos/:slug` detalle público e inscripción
- `/login` acceso administrativo
- `/admin` panel administrativo protegido

## Compilar

```bash
npm run build
```

## Qué persiste hoy

El sistema ya persiste en Turso:

- `contact_requests` para las solicitudes del formulario público
- `users` para los administradores
- `sessions` para las sesiones autenticadas por cookie HttpOnly
- `course_categories`, `courses`, `course_cohorts` y `enrollment_requests` para academia y publicación de cursos

Las tablas base históricas se crean automáticamente al iniciar el servidor si todavía no existen, pero para el modelo completo de cursos la fuente de verdad ya quedó en las migraciones.

## API de cursos

Pública:

- `GET /api/courses`
- `GET /api/courses/:slug`
- `POST /api/courses/:slug/enroll`

Administrativa:

- `GET /api/admin/course-categories`
- `POST /api/admin/course-categories`
- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `GET /api/admin/courses/:id`
- `PUT /api/admin/courses/:id`
- `POST /api/admin/courses/:id/cohorts`
- `PUT /api/admin/cohorts/:id`
- `GET /api/admin/enrollments`
- `PUT /api/admin/enrollments/:id`

## Desplegar backend en Render

El proyecto ya incluye [render.yaml](/home/juan/Documentos/Dev/Proyectos/RespellApp/render.yaml:1) para publicar el servidor como `Web Service` en Render.

Configuración esperada:

- `Build Command`: `npm install`
- `Start Command`: `npm start`
- `Health Check Path`: `/api/health`

Variables de entorno requeridas en Render:

- `TURSO_URL`
- `TURSO_TOKEN`

Pasos:

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. En Render crea `New > Blueprint` o `New > Web Service`.
3. Si usas Blueprint, Render leerá `render.yaml`.
4. Si usas Web Service manual, coloca los comandos indicados arriba.
5. Agrega `TURSO_URL` y `TURSO_TOKEN` en `Environment`.
6. Despliega y prueba `https://tu-servicio.onrender.com/api/health`.

Después de publicar el backend, el frontend en producción debe apuntar a la URL pública de Render para las rutas `/api`.

## Siguiente fase sugerida

- agregar panel administrativo para consultar leads y cursos desde Turso
- modelar cursos, instructores e inscripciones en tablas dedicadas
- integrar checkout o conexión con Ofirone para ventas
