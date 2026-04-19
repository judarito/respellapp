-- 002_courses_and_enrollments.sql
-- Modelo inicial para crear cursos, publicarlos y recibir inscripciones

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS course_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description TEXT,
  learning_objectives TEXT,
  target_audience TEXT,
  modality TEXT NOT NULL DEFAULT 'mixed',
  level TEXT NOT NULL DEFAULT 'all',
  duration_hours INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'COP',
  publication_status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES course_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (modality IN ('virtual', 'presential', 'mixed')),
  CHECK (publication_status IN ('draft', 'published', 'archived')),
  CHECK (duration_hours >= 0),
  CHECK (price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_courses_category_id
  ON courses(category_id);

CREATE INDEX IF NOT EXISTS idx_courses_publication_status
  ON courses(publication_status);

CREATE INDEX IF NOT EXISTS idx_courses_published_at
  ON courses(published_at DESC);

CREATE TABLE IF NOT EXISTS course_cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  title TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  enrollment_open_at TEXT,
  enrollment_close_at TEXT,
  capacity INTEGER,
  seats_reserved INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  instructor_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  public_url TEXT,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'COP',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CHECK (status IN ('draft', 'published', 'closed', 'cancelled')),
  CHECK (capacity IS NULL OR capacity >= 0),
  CHECK (seats_reserved >= 0),
  CHECK (price_cents IS NULL OR price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_course_cohorts_course_id
  ON course_cohorts(course_id);

CREATE INDEX IF NOT EXISTS idx_course_cohorts_status
  ON course_cohorts(status);

CREATE INDEX IF NOT EXISTS idx_course_cohorts_start_date
  ON course_cohorts(start_date);

CREATE TABLE IF NOT EXISTS enrollment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  document_number TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'web',
  enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by_user_id INTEGER,
  notes TEXT,
  FOREIGN KEY (cohort_id) REFERENCES course_cohorts(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (cohort_id, email),
  CHECK (status IN ('pending', 'confirmed', 'waitlist', 'cancelled', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_cohort_id
  ON enrollment_requests(cohort_id);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_course_id
  ON enrollment_requests(course_id);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_status
  ON enrollment_requests(status);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_enrolled_at
  ON enrollment_requests(enrolled_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_email
  ON enrollment_requests(email);
