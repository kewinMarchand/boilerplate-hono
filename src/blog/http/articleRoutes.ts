import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { toImageView } from '#/media/http/imageContract.ts'

import { articleContract, articleDetailContract } from './contract.ts'

import type { Article } from '#/blog/domain/Article.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

/** Champs de la liste, dans l'ordre du contrat ; le texte n'est servi que par la fiche. */
const toListItem = (
  { id, slug, title, excerpt, publishedAt, image }: Article.Entity,
  options: RouteOptions,
) => ({
  id,
  slug,
  title,
  excerpt,
  publishedAt,
  image: toImageView(options.mediaBaseUrl, image, 'article'),
})

export const articleRoutes = (repository: Article.Repository, options: RouteOptions) =>
  new OpenAPIHono()
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/articles',
        operationId: 'api_articles_get_collection',
        tags: ['Article'],
        summary: 'Retrieves the collection of Article resources.',
        description: 'Retrieves the collection of Article resources.',
        middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
        responses: {
          200: {
            description: 'Article collection',
            content: { 'application/json': { schema: z.array(articleContract) } },
          },
        },
      }),
      async (c) => {
        const articles = await repository.findLatestFirst()
        return c.json(
          articles.map((article) => toListItem(article, options)),
          200,
        )
      },
    )
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/articles/{slug}',
        operationId: 'api_articles_slug_get',
        tags: ['ArticleDetail'],
        summary: 'Retrieves a ArticleDetail resource.',
        description: 'Retrieves a ArticleDetail resource.',
        // Ressource unique : X-Scenario: empty n'a pas d'effet, comme dans l'API Platform
        middleware: [negotiateFormat(), scenario(options.scenarios)],
        request: {
          params: z.object({ slug: z.string().meta({ description: 'ArticleDetail identifier' }) }),
        },
        responses: {
          200: {
            description: 'ArticleDetail resource',
            content: { 'application/json': { schema: articleDetailContract } },
          },
          404: { description: 'Not found', content: problemContent(errorSchema) },
        },
      }),
      async (c) => {
        const article = await repository.findBySlug(c.req.valid('param').slug)
        if (article === null) {
          throw new HTTPException(404, { message: 'Not Found' })
        }

        return c.json({ ...toListItem(article, options), html: article.html }, 200)
      },
    )
