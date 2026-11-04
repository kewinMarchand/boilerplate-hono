import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'

import type { Context } from 'hono'

const COOKIE = 'admin_session'
/** Durée d'une session : une journée de travail, puis reconnexion. */
export const SESSION_SECONDS = 8 * 60 * 60

/** Cookie `Secure` seulement en HTTPS : les préprods de l'agence sont servies en HTTP sur Tailscale. */
const cookieOptions = (c: Context) =>
  ({
    path: '/admin',
    httpOnly: true,
    sameSite: 'Strict',
    secure: new URL(c.req.url).protocol === 'https:',
  }) as const

/**
 * Session sans stockage : adresse et échéance, signées par HMAC (ADMIN_SESSION_SECRET). Se
 * déconnecter efface le cookie ; une session volée resterait valable jusqu'à son échéance.
 */
export const openSession = async (
  c: Context,
  secret: string,
  email: string,
  now: number = Date.now(),
): Promise<void> => {
  const expiresAt = now + SESSION_SECONDS * 1000
  await setSignedCookie(c, COOKIE, `${email}|${expiresAt}`, secret, {
    ...cookieOptions(c),
    maxAge: SESSION_SECONDS,
  })
}

/** Adresse du compte connecté, ou null (pas de cookie, signature fausse, session échue). */
export const sessionEmail = async (
  c: Context,
  secret: string,
  now: number = Date.now(),
): Promise<string | null> => {
  const value = await getSignedCookie(c, secret, COOKIE)
  if (typeof value !== 'string') {
    return null
  }
  const separator = value.lastIndexOf('|')
  const email = value.slice(0, separator)
  const expiresAt = Number(value.slice(separator + 1))

  return separator > 0 && Number.isFinite(expiresAt) && expiresAt > now ? email : null
}

export const closeSession = (c: Context): void => {
  deleteCookie(c, COOKIE, cookieOptions(c))
}
