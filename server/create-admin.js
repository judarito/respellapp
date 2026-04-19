import 'dotenv/config'
import { createClient } from '@libsql/client'
import { hashPassword, normalizeEmail } from './auth.js'

const tursoUrl = process.env.TURSO_URL
const tursoToken = process.env.TURSO_TOKEN

if (!tursoUrl || !tursoToken) {
  throw new Error('Missing TURSO_URL or TURSO_TOKEN in environment variables.')
}

const [emailArg, passwordArg, nameArg] = process.argv.slice(2)

if (!emailArg || !passwordArg) {
  console.error('Usage: npm run create:admin -- <email> <password> [name]')
  process.exit(1)
}

const email = normalizeEmail(emailArg)
const password = String(passwordArg)
const name = String(nameArg || 'Administrador Respell').trim()

if (password.length < 8) {
  console.error('Password must have at least 8 characters.')
  process.exit(1)
}

const db = createClient({
  url: tursoUrl,
  authToken: tursoToken,
})

await db.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

const passwordHash = await hashPassword(password)

await db.execute({
  sql: `
    INSERT INTO users (email, password_hash, name, role)
    VALUES (?, ?, ?, 'admin')
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      name = excluded.name,
      role = 'admin'
  `,
  args: [email, passwordHash, name],
})

console.log(`Admin user ready: ${email}`)
