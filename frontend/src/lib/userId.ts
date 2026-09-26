import { read, write } from './storage'

// No auth (backend spec §1): the browser makes up a UUID once and sends it as X-User-Id.
const KEY = 'cv-user-id'
let current: string | null = null

export function getUserId(): string {
  current ??= read(KEY)
  if (!current) {
    current = crypto.randomUUID()
    write(KEY, current)
  }
  return current
}

/** "Reset demo user": a fresh id means a fresh profile, link and chat history on the backend. */
export function resetUserId(): string {
  current = crypto.randomUUID()
  write(KEY, current)
  return current
}
