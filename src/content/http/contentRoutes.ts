import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { alternates } from '#/shared/http/contentLocale.ts'
import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { legalPageTitleIn, translatedLegalBody } from '#/content/domain/LegalPage.ts'
import { META_PAGES, pageMetaIn } from '#/content/domain/PageMeta.ts'

import { legalPageContract, pageMetaContract } from './contract.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { PageMeta } from '#/content/domain/PageMeta.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

export interface ContentRepositories {
  readonly legalPages: LegalPage.Repository
  readonly pageMetas: PageMeta.Repository
  /** Rend le Markdown traduit d'une page légale (ADR 0014) ; un texte non traduit garde son rendu enregistré. */
  readonly legalPageRenderer: LegalPage.Renderer
}

/** Toutes les pages fixes, dans l'ordre du contrat, dans la langue `locale` ; une page sans document sort avec des chaînes vides. */
const allPageMetas = async ({ pageMetas }: ContentRepositories, locale: string) => {
  const saved = new Map(
    (await pageMetas.findAll()).map((meta) => [meta.page, pageMetaIn(meta, locale)]),
  )
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
      async (c) => {
        const { current } = await options.contentLocale(c.req.raw)
        return c.json(await allPageMetas(repositories, current), 200)
      },
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
        const locale = await options.contentLocale(c.req.raw)
        const body = translatedLegalBody(page, locale.current)
        const { introduction, sections } =
          body === null ? page : repositories.legalPageRenderer.split(body)

        return c.json(
          {
            slug: page.slug,
            title: legalPageTitleIn(page, locale.current),
            introduction,
            sections,
            alternates: alternates(locale, () => page.slug),
          },
          200,
        )
      },
    )
