-- 003_public_course_views.sql
-- Vistas útiles para catálogo público y operación administrativa

PRAGMA foreign_keys = ON;

CREATE VIEW IF NOT EXISTS v_published_courses AS
SELECT
  c.id,
  c.title,
  c.slug,
  c.short_description,
  c.description,
  c.modality,
  c.level,
  c.duration_hours,
  c.cover_image_url,
  c.price_cents,
  c.currency,
  c.published_at,
  cc.name AS category_name,
  cc.slug AS category_slug
FROM courses c
LEFT JOIN course_categories cc ON cc.id = c.category_id
WHERE c.publication_status = 'published';

CREATE VIEW IF NOT EXISTS v_published_course_cohorts AS
SELECT
  cohort.id,
  cohort.course_id,
  course.title AS course_title,
  course.slug AS course_slug,
  cohort.code,
  cohort.title,
  cohort.start_date,
  cohort.end_date,
  cohort.enrollment_open_at,
  cohort.enrollment_close_at,
  cohort.capacity,
  cohort.seats_reserved,
  cohort.location,
  cohort.instructor_name,
  COALESCE(cohort.price_cents, course.price_cents) AS effective_price_cents,
  COALESCE(cohort.currency, course.currency) AS effective_currency
FROM course_cohorts cohort
INNER JOIN courses course ON course.id = cohort.course_id
WHERE course.publication_status = 'published'
  AND cohort.status = 'published';
