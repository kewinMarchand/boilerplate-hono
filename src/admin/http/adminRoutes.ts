import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { createMiddleware } from 'hono/factory'

import { adminLanguage, t } from '#/shared/http/adminI18n.ts'
import { adminContentLocales } from '#/shared/http/adminTranslations.ts'

import { normalizeEmail } from '#/admin/domain/AdminUser.ts'
import { authenticate } from '#/admin/application/adminAccounts.ts'
import { PREVIEW_SCRIPT_HASH } from '#/media/http/adminImageFields.ts'

import { LoginThrottle } from './loginThrottle.ts'
import { dashboardPage, loginPage } from './pages.ts'
import { closeSession, openSession, sessionEmail } from './session.ts'

import type { AdminDependencies } from '#/admin/application/adminAccounts.ts'

/** Pages de l'admin : leurs styles en ligne, les images et fichiers audio du même hôte (et l'image choisie avant l'envoi), le script d'aperçu ; formulaires envoyés à l'admin seulement. */
export const ADMIN_CSP = `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' blob:; media-src 'self'; script-src ${PREVIEW_SCRIPT_HASH}; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`

const throttled = (minutes: number) =>
  minutes > 1 ? t('login.throttled', { minutes }) : t('login.throttled_one')

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

export interface AdminRouteOptions {
  readonly sessionSecret: string
  readonly throttle?: LoginThrottle
  /** Pages des autres modules (catalogue, contenus), montées derrière la même session, le même CSRF et la même CSP. */
  readonly sections?: readonly Hono[]
  /** Langues du contenu du site (ADR 0014), la langue par défaut en premier : onglets de langue des fiches. */
  readonly contentLocales?: () => Promise<readonly [string, ...string[]]>
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

  // Langue de l'interface choisie avant tout, page de connexion comprise
  const language = adminLanguage()
  const contentLocales = adminContentLocales(
    options.contentLocales ?? (() => Promise.resolve(['fr'])),
  )
  app.use('/admin', adminCsp, language, csrf(), requireSession, contentLocales)
  app.use('/admin/*', adminCsp, language, csrf(), requireSession, contentLocales)

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
      return c.html(loginPage({ error: t('login.invalid'), email }), 401)
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

  for (const section of options.sections ?? []) {
    app.route('/', section)
  }

  return app
}
