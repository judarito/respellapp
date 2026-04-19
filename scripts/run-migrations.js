import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

const tursoUrl = process.env.TURSO_URL
const tursoToken = process.env.TURSO_TOKEN

if (!tursoUrl || !tursoToken) {
  throw new Error('Missing TURSO_URL or TURSO_TOKEN in environment variables.')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.resolve(__dirname, '../migrations')

const db = createClient({
  url: tursoUrl,
  authToken: tursoToken,
})

async function ensureMigrationsTable() {
  await db.execute('PRAGMA foreign_keys = ON')
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()
}

async function getAppliedMigrations() {
  const result = await db.execute(`
    SELECT filename
    FROM schema_migrations
    ORDER BY filename ASC
  `)

  return new Set(result.rows.map((row) => String(row.filename)))
}

async function applyMigration(filename) {
  const filepath = path.join(migrationsDir, filename)
  const sql = await fs.readFile(filepath, 'utf8')
  const statements = splitSqlStatements(sql)

  if (statements.length === 0) {
    console.log(`Skipping empty migration: ${filename}`)
    return
  }

  console.log(`Applying ${filename}...`)

  await db.batch([
    ...statements,
    {
      sql: `
        INSERT INTO schema_migrations (filename)
        VALUES (?)
      `,
      args: [filename],
    },
  ], 'write')
}

function splitSqlStatements(sql) {
  const statements = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const nextChar = sql[index + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
      }
      continue
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false
        index += 1
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true
        index += 1
        continue
      }

      if (char === '/' && nextChar === '*') {
        inBlockComment = true
        index += 1
        continue
      }
    }

    if (char === "'" && !inDoubleQuote) {
      const escapedSingleQuote = nextChar === "'"

      current += char

      if (escapedSingleQuote) {
        current += nextChar
        index += 1
        continue
      }

      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      current += char
      continue
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim()

      if (statement) {
        statements.push(statement)
      }

      current = ''
      continue
    }

    current += char
  }

  const trailingStatement = current.trim()

  if (trailingStatement) {
    statements.push(trailingStatement)
  }

  return statements
}

async function main() {
  await ensureMigrationsTable()

  const migrationFiles = await getMigrationFiles()
  const appliedMigrations = await getAppliedMigrations()

  if (migrationFiles.length === 0) {
    console.log('No migrations found in /migrations.')
    return
  }

  let appliedCount = 0

  for (const filename of migrationFiles) {
    if (appliedMigrations.has(filename)) {
      console.log(`Already applied: ${filename}`)
      continue
    }

    await applyMigration(filename)
    appliedCount += 1
  }

  if (appliedCount === 0) {
    console.log('Database is already up to date.')
    return
  }

  console.log(`Applied ${appliedCount} migration(s) successfully.`)
}

main().catch((error) => {
  console.error('Migration runner failed:', error)
  process.exit(1)
})
