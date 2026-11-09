import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { contentLanguage, contentLocaleResolver } from '#/shared/http/contentLocale.ts'
import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { contentSecurityPolicy } from '#/shared/http/contentSecurityPolicy.ts'
import { cors } from '#/shared/http/cors.ts'
import {
  DeserializationError,
  NotAcceptableError,
  NotExposedError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '#/shared/http/httpErrors.ts'
import { negotiate, OPENAPI_MIME, PROBLEM_MIME } from '#/shared/http/negotiation.ts'
import { openApiDocument } from '#/shared/http/openapiDocument.ts'
import { errorFlavor, problemBody, violationsBody } from '#/shared/http/problem.ts'
import { routingErrorResponse } from '#/shared/http/routingErrors.ts'
import { scenario, SimulatedServerError } from '#/shared/http/scenario.ts'
import { NO_ERROR_REPORTING } from '#/shared/infrastructure/errorReporting.ts'

import { CategoryNotFoundError } from '#/catalog/domain/CategoryNotFoundError.ts'
import { getSiteIdentity } from '#/site/application/siteIdentity.ts'
import { adminRoutes } from '#/admin/http/adminRoutes.ts'
import { adminBlogRoutes } from '#/blog/http/adminBlog.ts'
import { articleRoutes } from '#/blog/http/articleRoutes.ts'
import { adminCatalogRoutes } from '#/catalog/http/adminCatalogRoutes.ts'
import { catalogRoutes } from '#/catalog/http/catalogRoutes.ts'
import { adminContactMessageRoutes } from '#/contact/http/adminContactMessages.ts'
import { contactMessageRoutes } from '#/contact/http/contactMessageRoutes.ts'
import { ContactMessageValidationError } from '#/contact/http/ContactMessageValidationError.ts'
import { adminContentRoutes } from '#/content/http/adminContent.ts'
import { contentRoutes } from '#/content/http/contentRoutes.ts'
import { mediaRoutes } from '#/media/http/mediaRoutes.ts'
import { adminSiteRoutes } from '#/site/http/adminSite.ts'
import { siteIdentityRoutes } from '#/site/http/siteIdentityRoutes.ts'
import { taskRoutes } from '#/task/http/taskRoutes.ts'

import type { AdminDependencies } from '#/admin/application/adminAccounts.ts'
import type { BlogAdminDependencies } from '#/blog/application/adminBlog.ts'
import type { CatalogAdminDependencies } from '#/catalog/application/adminCatalog.ts'
import type { CatalogRepositories } from '#/catalog/application/searchProducts.ts'
import type { Config } from '#/config.ts'
import type { ContactDependencies } from '#/contact/application/receiveContactMessage.ts'
import type { ContentAdminDependencies } from '#/content/application/adminContent.ts'
import type { ContentRepositories } from '#/content/http/contentRoutes.ts'
import type { ErrorReporter } from '#/shared/infrastructure/errorReporting.ts'
import type { SiteDependencies } from '#/site/application/siteIdentity.ts'
import type { Task } from '#/task/domain/Task.ts'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export interface AppDependencies
  extends
    CatalogRepositories,
    ContentRepositories,
    AdminDependencies,
    CatalogAdminDependencies,
    BlogAdminDependencies,
    ContentAdminDependencies,
    SiteDependencies,
    ContactDependencies {
  readonly tasks: Task.Repository
}

export type AppConfig = Pick<
  Config,
  'APP_ENV' | 'CORS_ALLOW_ORIGIN' | 'ADMIN_SESSION_SECRET' | 'MEDIA_BASE_URL' | 'MEDIA_DIR'
>

/** Ressources dont API Platform déclare l'item (pour générer les IRI) sans l'exposer. */
const NOT_EXPOSED_ITEMS = [
  '/api/tasks/:id',
  '/api/articles/:id',
  '/api/categories/:slug',
  '/api/contact_messages/:id',
]

const statusOf = (error: unknown): ContentfulStatusCode => {
  if (error instanceof CategoryNotFoundError || error instanceof NotExposedError) {
    return 404
  }
  if (error instanceof NotAcceptableError) {
    return 406
  }
  if (error instanceof PayloadTooLargeError) {
    return 413
  }
  if (error instanceof UnsupportedMediaTypeError) {
    return 415
  }
  if (error instanceof HTTPException) {
    return error.status
  }

  return 500
}

/**
 * Erreurs attendues, ni journalisées ni envoyées à GlitchTip : toutes les 4xx, les 500 simulées
 * par X-Scenario et les erreurs de désérialisation (corps invalide, 500 par parité avec
 * l'API Platform mais causées par le client).
 */
const isExpected = (error: unknown): boolean =>
  error instanceof SimulatedServerError ||
  error instanceof DeserializationError ||
  statusOf(error) < 500

/**
 * `reporter` (GlitchTip) ne reçoit que les erreurs inattendues : les routes inconnues (404, 405)
 * ne passent pas par onError, la 422 de validation est traitée avant, `isExpected` écarte le reste.
 */
export const createApp = (
  dependencies: AppDependencies,
  config: AppConfig,
  reporter: ErrorReporter = NO_ERROR_REPORTING,
) => {
  const scenarios = config.APP_ENV !== 'prod'
  const contentLocale = contentLocaleResolver(
    async () => (await getSiteIdentity(dependencies)).locales,
    scenarios,
  )
  const options = { scenarios, mediaBaseUrl: config.MEDIA_BASE_URL, contentLocale }
  const app = new OpenAPIHono()
  const reportMailFailure = (error: unknown): void => {
    console.error('Envoi du mail du message de contact en échec', error)
    reporter.capture(error, { method: 'POST', path: '/api/contact_messages' })
  }

  app.use('*', contentSecurityPolicy())
  app.use('/api/*', contentLanguage(contentLocale))
  app.use('/api/*', cors(config.CORS_ALLOW_ORIGIN))
  app.route('/', mediaRoutes(config.MEDIA_DIR))

  const routes = app
    .route('/', taskRoutes(dependencies.tasks, options))
    .route(
      '/',
      articleRoutes(
        dependencies.articles,
        dependencies.articleTerms,
        dependencies.articleRenderer,
        options,
      ),
    )
    .route('/', contactMessageRoutes(dependencies, options, reportMailFailure))
    .route('/', catalogRoutes(dependencies, options))
    .route('/', contentRoutes(dependencies, options))
    .route('/', siteIdentityRoutes(dependencies, options))

  for (const path of NOT_EXPOSED_ITEMS) {
    app.get(path, negotiateFormat(), () => {
      throw new NotExposedError()
    })
  }

  const docsMiddleware = [negotiateFormat([OPENAPI_MIME]), scenario(options.scenarios)] as const
  app.get('/api/docs.jsonopenapi', ...docsMiddleware, (c) =>
    c.body(JSON.stringify(openApiDocument(app)), 200, { 'Content-Type': OPENAPI_MIME }),
  )
  app.get('/api/docs', scenario(options.scenarios), async (c, next) => {
    const accept = c.req.header('Accept') ?? ''
    if (negotiate(accept, [OPENAPI_MIME, 'text/html']) === 'text/html') {
      return swaggerUI({ url: '/api/docs.jsonopenapi', title: 'API de test Kewin' })(c, next)
    }

    return c.body(JSON.stringify(openApiDocument(app)), 200, { 'Content-Type': OPENAPI_MIME })
  })

  app.route(
    '/',
    adminRoutes(dependencies, {
      sessionSecret: config.ADMIN_SESSION_SECRET,
      contentLocales: async () => (await getSiteIdentity(dependencies)).locales,
      sections: [
        adminCatalogRoutes(dependencies),
        adminBlogRoutes(dependencies),
        adminContentRoutes(dependencies),
        adminSiteRoutes(dependencies),
        adminContactMessageRoutes(dependencies),
      ],
    }),
  )

  app.notFound((c) => routingErrorResponse(c, app.routes))

  app.onError((error, c) => {
    const flavor = errorFlavor(c.req.header('Accept'))
    const headers = { 'Content-Type': PROBLEM_MIME }

    if (error instanceof ContactMessageValidationError) {
      return c.json(violationsBody(flavor, error.violations), 422, headers)
    }

    const status = statusOf(error)
    if (!isExpected(error)) {
      console.error(error)
      reporter.capture(error, { method: c.req.method, path: c.req.path })
    }
    const detail =
      status >= 500 && config.APP_ENV === 'prod' ? 'Internal Server Error' : error.message

    return c.json(problemBody(flavor, status, detail), status, headers)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
