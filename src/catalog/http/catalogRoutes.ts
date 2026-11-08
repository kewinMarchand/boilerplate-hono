import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { attributeValuesOf } from '#/catalog/domain/productAttribute.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { emptyProductList } from '#/catalog/domain/productSearch.ts'
import { searchProducts } from '#/catalog/application/searchProducts.ts'
import { toImageView } from '#/media/http/imageContract.ts'

import {
  categoryNodeContract,
  productContract,
  productDetailContract,
  productFacetsContract,
} from './contract.ts'
import {
  productFacetsQueryDocumentation,
  productQueryDocumentation,
  rawCriteriaFromQuery,
} from './productQuery.ts'

import type { CatalogRepositories } from '#/catalog/application/searchProducts.ts'
import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

/**
 * Élément de liste du contrat : sans `featured`, qui ne sert qu'à l'admin et au choix du carrousel,
 * ni `description`, réservée à la fiche ; attributs renseignés lus avec leurs définitions.
 */
const toProductItem = (
  product: Catalog.Product,
  attributes: readonly Catalog.ProductAttribute[],
  options: RouteOptions,
) => {
  const { featured: _, description: __, attributeValues: ___, image, ...item } = product

  return {
    ...item,
    image: toImageView(options.mediaBaseUrl, image, 'product'),
    attributes: attributeValuesOf(product, attributes),
  }
}

const toProductFacets = ({ totalItems, facets }: Catalog.ProductList) => ({
  totalItems,
  ...facets,
})

export const catalogRoutes = (repositories: CatalogRepositories, options: RouteOptions) => {
  const search = (url: string) =>
    searchProducts(parseCriteria(rawCriteriaFromQuery(new URL(url).search)), repositories)

  return new OpenAPIHono()
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
        operationId: 'api_products_get_collection',
        tags: ['Product'],
        summary: 'Retrieves the collection of Product resources.',
        description: 'Retrieves the collection of Product resources.',
        middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
        request: { query: productQueryDocumentation },
        responses: {
          200: {
            description: 'Product collection',
            content: { 'application/json': { schema: z.array(productContract) } },
          },
        },
      }),
      async (c) => {
        const { items } = await search(c.req.url)
        const attributes = await repositories.attributes.findAll()

        return c.json(
          items.map((product) => toProductItem(product, attributes, options)),
          200,
        )
      },
    )
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/product-facets',
        operationId: 'api_product-facets_get',
        tags: ['ProductFacets'],
        summary: 'Retrieves a ProductFacets resource.',
        description: 'Retrieves a ProductFacets resource.',
        middleware: [
          negotiateFormat(),
          scenario(options.scenarios, () => toProductFacets(emptyProductList())),
        ],
        request: { query: productFacetsQueryDocumentation },
        responses: {
          200: {
            description: 'ProductFacets resource',
            content: { 'application/json': { schema: productFacetsContract } },
          },
          404: { description: 'Not found', content: problemContent(errorSchema) },
        },
      }),
      async (c) => c.json(toProductFacets(await search(c.req.url)), 200),
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

        const attributes = await repositories.attributes.findAll()

        return c.json(
          {
            ...toProductItem(product, attributes, options),
            categoryPath,
            description: product.description,
          },
          200,
        )
      },
    )
    .openapi(
      createRoute({
        method: 'get',
        path: '/api/featured-products',
        operationId: 'api_featured-products_get_collection',
        tags: ['Product'],
        summary: 'Retrieves the collection of Product resources.',
        description: 'Retrieves the collection of Product resources.',
        middleware: [negotiateFormat(), scenario(options.scenarios, () => [])],
        responses: {
          200: {
            description: 'Product collection',
            content: { 'application/json': { schema: z.array(productContract) } },
          },
        },
      }),
      async (c) => {
        const products = await repositories.products.findFeatured()
        const attributes = await repositories.attributes.findAll()
        return c.json(
          products.map((product) => toProductItem(product, attributes, options)),
          200,
        )
      },
    )
}
