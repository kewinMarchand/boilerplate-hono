import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { legalPageContract } from './contract.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

export interface ContentRepositories {
  readonly legalPages: LegalPage.Repository
}

export const contentRoutes = (repositories: ContentRepositories, options: RouteOptions) =>
  new OpenAPIHono().openapi(
    createRoute({
      method: 'get',
      path: '/api/legal_pages/{slug}',
      operationId: 'api_legal_pages_slug_get',
      tags: ['LegalPage'],
      summary: 'Retrieves a LegalPage resource.',
      description: 'Retrieves a LegalPage resource.',
      // Ressource unique : X-Scenario: empty n'a pas d'effet, comme dans l'API Platform
      middleware: [negotiateFormat(), scenario(options.scenarios)],
      request: {
        params: z.object({ slug: z.string().meta({ description: 'LegalPage identifier' }) }),
      },
      responses: {
        200: {
          description: 'LegalPage resource',
          content: { 'application/json': { schema: legalPageContract } },
        },
        404: { description: 'Not found', content: problemContent(errorSchema) },
      },
    }),
    async (c) => {
      const page = await repositories.legalPages.findBySlug(c.req.valid('param').slug)
      if (page === null) {
        throw new HTTPException(404, { message: 'Not Found' })
      }

      return c.json(page, 200)
    },
  )
