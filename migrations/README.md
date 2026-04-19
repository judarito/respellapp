# Migraciones

Estas migraciones existen para llevar trazabilidad del modelo de datos del proyecto.

## Orden actual

1. `001_base_auth_and_contacts.sql`
2. `002_courses_and_enrollments.sql`
3. `003_public_course_views.sql`

## Convención

- prefijo numérico incremental
- nombres descriptivos
- scripts idempotentes usando `IF NOT EXISTS` cuando aplica

## Cómo ejecutarlas

Usa el runner principal:

```bash
npm run migrate
```

O, si prefieres el wrapper shell:

```bash
sh scripts/run-migrations.sh
```

## Trazabilidad

El runner crea y mantiene la tabla `schema_migrations` en Turso.

Cada archivo `.sql` se registra una sola vez cuando se aplica correctamente, así el historial del esquema queda persistido junto a la base de datos.
