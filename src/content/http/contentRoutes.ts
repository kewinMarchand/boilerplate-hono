import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { META_PAGES } from '#/content/domain/PageMeta.ts'

import { legalPageContract, pageMetaContract } from './contract.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { PageMeta } from '#/content/domain/PageMeta.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

export interface ContentRepositories {
  readonly legalPages: LegalPage.Repository
  readonly pageMetas: PageMeta.Repository
}

/** Toutes les pages fixes, dans l'ordre du contrat ; une page sans document sort avec des chaînes vides. */
const allPageMetas = async ({ pageMetas }: ContentRepositories) => {
  const saved = new Map((await pageMetas.findAll()).map((meta) => [meta.page, meta]))
  return META_PAGES.map(([page]) => ({
    page,
    title: saved.get(page)?.title ?? '',
    description: saved.get(page)?.description ?? '',
  }))
}

export const contentRoutes = (repositories: ContentRepositories, options: RouteOptions) =>
  new OpenAPIHono()
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/page-metas',
        operationId: 'api_page-metas_get_collection',
        tags: ['PageMeta'],
        summary: 'Retrieves the collection of PageMeta resources.',
        description: 'Retrieves the collection of PageMeta resources.',
        middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
        responses: {
          200: {
            description: 'PageMeta collection',
            content: { 'application/json': { schema: z.array(pageMetaContract) } },
          },
        },
      }),
      async (c) => c.json(await allPageMetas(repositories), 200),
    )
    .openapi(
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
