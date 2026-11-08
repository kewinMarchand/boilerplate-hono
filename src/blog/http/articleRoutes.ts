import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { parsePhpQuery } from '#/shared/http/phpQuery.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { toAudioView, toImageView } from '#/media/http/imageContract.ts'

import {
  articleContract,
  articleDetailContract,
  articleQueryDocumentation,
  articleTermContract,
} from './contract.ts'

import type { Article } from '#/blog/domain/Article.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

const toTermLink = (term: Article.Term | null) =>
  term === null ? null : { slug: term.slug, name: term.name }

/** Champs de la liste, dans l'ordre du contrat ; le texte et le référencement ne sont servis que par la fiche. */
const toListItem = (
  { id, slug, title, excerpt, publishedAt, image, section, format, audio, speaker }: Article.Entity,
  options: RouteOptions,
) => ({
  id,
  slug,
  title,
  excerpt,
  publishedAt,
  image: toImageView(options.mediaBaseUrl, image, 'article'),
  section: toTermLink(section),
  format: toTermLink(format),
  audio: toAudioView(options.mediaBaseUrl, audio),
  speaker,
})

/** Slug d'un filtre, comme le lit l'API Platform : une chaîne non vide, sinon pas de filtre. */
const filterSlug = (search: string, name: string): string | null => {
  const value = parsePhpQuery(search).get(name)
  return typeof value === 'string' && value !== '' ? value : null
}

/** Un slug que ne porte aucun article (inconnu compris) donne une liste vide. */
const matches = (term: Article.Term | null, slug: string | null): boolean =>
  slug === null || term?.slug === slug

const termRoute = (
  terms: Pick<Article.TermRepository, 'findByKind'>,
  options: RouteOptions,
  kind: Article.TermKind,
  path: '/api/article-sections' | '/api/article-formats',
) =>
  new OpenAPIHono().openapi(
    createRoute({
      method: 'get',
      path,
      operationId: `api_${path.slice('/api/'.length)}_get_collection`,
      tags: ['ArticleTerm'],
      summary: 'Retrieves the collection of ArticleTerm resources.',
      description: 'Retrieves the collection of ArticleTerm resources.',
      middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
      responses: {
        200: {
          description: 'ArticleTerm collection',
          content: { 'application/json': { schema: z.array(articleTermContract) } },
        },
      },
    }),
    async (c) =>
      c.json(
        (await terms.findByKind(kind)).map(({ slug, name }) => ({ slug, name })),
        200,
      ),
  )

export const articleRoutes = (
  repository: Article.Repository,
  terms: Pick<Article.TermRepository, 'findByKind'>,
  options: RouteOptions,
) =>
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
        request: { query: articleQueryDocumentation },
        responses: {
          200: {
            description: 'Article collection',
            content: { 'application/json': { schema: z.array(articleContract) } },
          },
        },
      }),
      async (c) => {
        const search = new URL(c.req.url).search
        const section = filterSlug(search, 'section')
        const format = filterSlug(search, 'format')
        const articles = (await repository.findLatestFirst()).filter(
          (article) => matches(article.section, section) && matches(article.format, format),
        )
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

        return c.json(
          {
            ...toListItem(article, options),
            html: article.html,
            metaTitle: article.metaTitle,
            metaDescription: article.metaDescription,
          },
          200,
        )
      },
    )
    .route('/', termRoute(terms, options, 'section', '/api/article-sections'))
    .route('/', termRoute(terms, options, 'format', '/api/article-formats'))
