import { createMiddleware } from 'hono/factory'

const ALLOW_METHODS = ['GET', 'POST', 'OPTIONS']
const ALLOW_HEADERS = ['content-type', 'accept', 'x-scenario']
const SIMPLE_HEADERS = ['accept', 'accept-language', 'content-language', 'origin']
const MAX_AGE = '3600'

/**
 * Reproduit nelmio/cors-bundle tel que configuré dans boilerplate-api-platform : préflight
 * répondu avant le routage, en-têtes renvoyés même pour une origine refusée (sans
 * Access-Control-Allow-Origin), 405 pour une méthode refusée, 400 pour un en-tête refusé.
 */
export const cors = (allowOriginPattern: string) => {
  const allowOrigin = new RegExp(allowOriginPattern, 'i')

  return createMiddleware(async (c, next) => {
    const origin = c.req.header('Origin')
    if (origin === undefined) {
      await next()
      return
    }

    const requestMethod = c.req.header('Access-Control-Request-Method')
    if (c.req.method !== 'OPTIONS' || requestMethod === undefined) {
      await next()
      if (allowOrigin.test(origin)) {
        c.res.headers.set('Access-Control-Allow-Origin', origin)
      }
      return
    }

    const headers = new Headers({
      'Access-Control-Allow-Methods': ALLOW_METHODS.join(', '),
      'Access-Control-Allow-Headers': ALLOW_HEADERS.join(', '),
      'Access-Control-Max-Age': MAX_AGE,
      'Cache-Control': 'no-cache, private',
      'Content-Type': 'text/html; charset=UTF-8',
      Vary: 'Origin',
    })
    if (!allowOrigin.test(origin)) {
      return new Response(null, { status: 200, headers })
    }
    headers.set('Access-Control-Allow-Origin', origin)

    if (!ALLOW_METHODS.includes(requestMethod.toUpperCase())) {
      return new Response(null, { status: 405, headers })
    }

    const requestHeaders = (c.req.header('Access-Control-Request-Headers') ?? '')
      .trim()
      .toLowerCase()
    if (requestHeaders !== '') {
      const refused = requestHeaders
        .split(/, */)
        .find((header) => !SIMPLE_HEADERS.includes(header) && !ALLOW_HEADERS.includes(header))
      if (refused !== undefined) {
        return new Response(`Unauthorized header ${refused}`, { status: 400, headers })
      }
    }

    return new Response(null, { status: 200, headers })
  })
}
