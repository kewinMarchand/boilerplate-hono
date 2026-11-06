import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { emptyProductList } from '#/catalog/domain/productSearch.ts'
import { searchProducts } from '#/catalog/application/searchProducts.ts'
import { toImageView } from '#/media/http/imageContract.ts'

import { categoryNodeContract, productListContract } from './contract.ts'
import { productQueryDocumentation, rawCriteriaFromQuery } from './productQuery.ts'

import type { CatalogRepositories } from '#/catalog/application/searchProducts.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

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
          {
            ...list,
            items: list.items.map((product) => ({
              ...product,
              image: toImageView(options.mediaBaseUrl, product.image, 'product'),
            })),
          },
          200,
        )
      },
    )
