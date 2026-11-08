import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { emptyProductList } from '#/catalog/domain/productSearch.ts'
import { searchProducts } from '#/catalog/application/searchProducts.ts'
import { toImageView } from '#/media/http/imageContract.ts'

import {
  categoryNodeContract,
  featuredProductContract,
  productDetailContract,
  productListContract,
} from './contract.ts'
import { productQueryDocumentation, rawCriteriaFromQuery } from './productQuery.ts'

import type { CatalogRepositories } from '#/catalog/application/searchProducts.ts'
import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

/** Élément de liste du contrat : sans `featured`, qui ne sert qu'à l'admin et au choix du carrousel, ni `description`, réservée à la fiche. */
const toProductItem = (
  { featured: _, description: __, image, ...product }: Catalog.Product,
  options: RouteOptions,
) => ({ ...product, image: toImageView(options.mediaBaseUrl, image, 'product') })

export const catalogRoutes = (repositories: CatalogRepositories, options: RouteOptions) =>
  new OpenAPIHono()
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/categories',
        operationId: 'api_categories_get_collection',
        tags: ['Category'],
        summary: 'Retrieves the collection of Category resources.',
        description:
          "Renvoie l'arbre des catégories : les catégories racines, chacune avec ses enfants, triées par position.",
        middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
        responses: {
          200: {
            description: 'Category collection',
            content: { 'application/json': { schema: z.array(categoryNodeContract) } },
          },
        },
      }),
      async (c) =>
        c.json(CategoryTree.toNodes(CategoryTree.of(await repositories.categories.findAll())), 200),
    )
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/products',
        operationId: 'api_products_get',
        tags: ['ProductList'],
        summary: 'Retrieves a ProductList resource.',
        description:
          "Liste les produits du catalogue. Les filtres se combinent en ET, les valeurs d'une même facette en OU. Une valeur invalide (inconnue, non numérique, hors bornes) est ignorée et remplacée par la valeur par défaut.",
        middleware: [negotiateFormat(), scenario(options.scenarios, emptyProductList)],
        request: { query: productQueryDocumentation },
        responses: {
          200: {
            description: 'ProductList resource',
            content: { 'application/json': { schema: productListContract } },
          },
          404: { description: 'Not found', content: problemContent(errorSchema) },
        },
      }),
      async (c) => {
        const criteria = parseCriteria(rawCriteriaFromQuery(new URL(c.req.url).search))

        const list = await searchProducts(criteria, repositories)

        return c.json(
          { ...list, items: list.items.map((product) => toProductItem(product, options)) },
          200,
        )
      },
    )
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/products/{slug}',
        operationId: 'api_products_slug_get',
        tags: ['ProductDetail'],
        summary: 'Retrieves a ProductDetail resource.',
        description: 'Retrieves a ProductDetail resource.',
        // Ressource unique : X-Scenario: empty n'a pas d'effet, comme dans l'API Platform
        middleware: [negotiateFormat(), scenario(options.scenarios)],
        request: {
          params: z.object({ slug: z.string().meta({ description: 'ProductDetail identifier' }) }),
        },
        responses: {
          200: {
            description: 'ProductDetail resource',
            content: { 'application/json': { schema: productDetailContract } },
          },
          404: { description: 'Not found', content: problemContent(errorSchema) },
        },
      }),
      async (c) => {
        const product = await repositories.products.findBySlug(c.req.valid('param').slug)
        if (product === null) {
          throw new HTTPException(404, { message: 'Not Found' })
        }
        const tree = CategoryTree.of(await repositories.categories.findAll())
        const categoryPath = CategoryTree.pathTo(tree, product.categorySlug).map((slug) => {
          const { name } = CategoryTree.find(tree, slug)
          return { slug, name }
        })

        return c.json(
          { ...toProductItem(product, options), categoryPath, description: product.description },
          200,
        )
      },
    )
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/featured-products',
        operationId: 'api_featured-products_get_collection',
        tags: ['FeaturedProduct'],
        summary: 'Retrieves the collection of FeaturedProduct resources.',
        description: 'Retrieves the collection of FeaturedProduct resources.',
        middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
        responses: {
          200: {
            description: 'FeaturedProduct collection',
            content: { 'application/json': { schema: z.array(featuredProductContract) } },
          },
        },
      }),
      async (c) => {
        const products = await repositories.products.findFeatured()
        return c.json(
          products.map((product) => toProductItem(product, options)),
          200,
        )
      },
    )
