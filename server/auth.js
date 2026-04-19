import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(crypto.scrypt)

export const SESSION_COOKIE = 'respell_session'
export const SESSION_DURATION_DAYS = 7

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, 64)

  return `scrypt$${salt}$${Buffer.from(derivedKey).toString('hex')}`
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, originalHash] = String(storedHash || '').split('$')

  if (algorithm !== 'scrypt' || !salt || !originalHash) {
    return false
  }

  const derivedKey = await scryptAsync(password, salt, 64)
  const candidateBuffer = Buffer.from(derivedKey)
  const originalBuffer = Buffer.from(originalHash, 'hex')

  if (candidateBuffer.length !== originalBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(candidateBuffer, originalBuffer)
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

export function addDays(date, amount) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000)
}

export function serializeSessionCookie(token, maxAgeSeconds) {
  const cookieParts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  return cookieParts.join('; ')
}

export function serializeExpiredSessionCookie() {
  const cookieParts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  return cookieParts.join('; ')
}

export function parseCookies(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf('=')

      if (separatorIndex === -1) {
        return accumulator
      }

      const key = entry.slice(0, separatorIndex).trim()
      const value = entry.slice(separatorIndex + 1).trim()
      accumulator[key] = decodeURIComponent(value)
      return accumulator
    }, {})
}
