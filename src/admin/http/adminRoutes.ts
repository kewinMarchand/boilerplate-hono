import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { createMiddleware } from 'hono/factory'

import { normalizeEmail } from '#/admin/domain/AdminUser.ts'
import { authenticate } from '#/admin/application/adminAccounts.ts'

import { LoginThrottle } from './loginThrottle.ts'
import { dashboardPage, loginPage } from './pages.ts'
import { closeSession, openSession, sessionEmail } from './session.ts'

import type { AdminDependencies } from '#/admin/application/adminAccounts.ts'

/** Pages de l'admin : leurs styles en ligne, rien d'autre ; formulaires envoyés à l'admin seulement. */
export const ADMIN_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"

const INVALID_CREDENTIALS = 'Identifiants invalides.'

const throttled = (minutes: number) =>
  `Plusieurs tentatives de connexion ont échoué, veuillez réessayer dans ${minutes} minute${minutes > 1 ? 's' : ''}.`

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

export interface AdminRouteOptions {
  readonly sessionSecret: string
  readonly throttle?: LoginThrottle
}

/**
 * Admin (ADR 0001) : connexion par session, hors du contrat public. Toute page sauf la connexion
 * exige une session ; les envois de formulaire sont refusés d'une autre origine (hono/csrf).
 */
export const adminRoutes = (dependencies: AdminDependencies, options: AdminRouteOptions) => {
  const throttle = options.throttle ?? new LoginThrottle()
  const secret = options.sessionSecret
  const app = new Hono<{ Variables: { adminEmail: string } }>()

  const adminCsp = createMiddleware(async (c, next) => {
    await next()
    c.res.headers.set('Content-Security-Policy', ADMIN_CSP)
  })

  /** Tout l'espace /admin exige une session, sauf la page de connexion. */
  const requireSession = createMiddleware<{ Variables: { adminEmail: string } }>(
    async (c, next) => {
      if (c.req.path === '/admin/login') {
        return next()
      }
      const email = await sessionEmail(c, secret)
      if (email === null) {
        return c.redirect('/admin/login', 302)
      }
      c.set('adminEmail', email)
      await next()
    },
  )

  app.use('/admin', adminCsp, csrf(), requireSession)
  app.use('/admin/*', adminCsp, csrf(), requireSession)

  app.get('/admin/login', async (c) =>
    (await sessionEmail(c, secret)) === null ? c.html(loginPage()) : c.redirect('/admin', 303),
  )

  app.post('/admin/login', async (c) => {
    const form = await c.req.parseBody()
    const email = text(form.email)
    const key = normalizeEmail(email)
    const minutes = throttle.minutesBeforeRetry(key)
    if (minutes > 0) {
      return c.html(loginPage({ error: throttled(minutes), email }), 429)
    }
    const user = await authenticate(dependencies, email, text(form.password))
    if (user === null) {
      throttle.fail(key)
      return c.html(loginPage({ error: INVALID_CREDENTIALS, email }), 401)
    }
    throttle.reset(key)
    await openSession(c, secret, user.email)

    return c.redirect('/admin', 303)
  })

  app.post('/admin/logout', (c) => {
    closeSession(c)
    return c.redirect('/admin/login', 303)
  })

  app.get('/admin', (c) => c.html(dashboardPage(c.get('adminEmail'))))

  return app
}
