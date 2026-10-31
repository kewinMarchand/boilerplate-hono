import { createMiddleware } from 'hono/factory'

export const API_CSP = "default-src 'none'; frame-ancestors 'none'"

/**
 * CSP d'une API JSON : rien à charger, rien à afficher en iframe. Même en-tête que
 * boilerplate-api-platform. Les réponses HTML (Swagger UI de /api/docs) en sont exclues : elles
 * chargent leurs scripts et leurs styles.
 */
export const contentSecurityPolicy = () =>
  createMiddleware(async (c, next) => {
    await next()
    if (!(c.res.headers.get('Content-Type') ?? '').startsWith('text/html')) {
      c.res.headers.set('Content-Security-Policy', API_CSP)
    }
  })
