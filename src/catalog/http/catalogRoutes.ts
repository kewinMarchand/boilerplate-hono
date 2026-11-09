import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { alternates } from '#/shared/http/contentLocale.ts'
import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { attributeIn, categoryIn, productIn } from '#/catalog/domain/catalogTranslations.ts'
import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { attributeValuesOf } from '#/catalog/domain/productAttribute.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { emptyProductList } from '#/catalog/domain/productSearch.ts'
import { searchProducts } from '#/catalog/application/searchProducts.ts'
import { imageView, toImageView } from '#/media/http/imageContract.ts'

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

import type { CategoryNode } from './contract.ts'
import type { CatalogRepositories } from '#/catalog/application/searchProducts.ts'
import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { RequestLocale } from '#/shared/http/contentLocale.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

/** Ce qu'il faut pour servir des produits dans une langue : l'arbre (slugs de catégorie) et les attributs, traduits. */
interface CatalogInLocale {
  readonly locale: string
  readonly tree: CategoryTree
  readonly attributes: readonly Catalog.ProductAttribute[]
}

const catalogIn = async (
  repositories: CatalogRepositories,
  locale: string,
): Promise<CatalogInLocale> => ({
  locale,
  tree: CategoryTree.of(await repositories.categories.findAll()),
  attributes: (await repositories.attributes.findAll()).map((attribute) =>
    attributeIn(attribute, locale),
  ),
})

/** Slug d'une catégorie (slug de la langue par défaut) dans la langue servie. */
const categorySlugIn = ({ tree, locale }: CatalogInLocale, slug: string): string =>
  categoryIn(CategoryTree.find(tree, slug), locale).slug

/**
 * Élément de liste du contrat, dans la langue servie : sans `featured`, qui ne sert qu'à l'admin et
 * au choix du carrousel, ni `description`, la galerie et le référencement, réservés à la fiche ;
 * attributs renseignés lus avec leurs définitions.
 */
const toProductItem = (
  product: Catalog.Product,
  catalog: CatalogInLocale,
  options: RouteOptions,
) => {
  const {
    featured: _,
    description: __,
    attributeValues: ___,
    gallery: ____,
    metaTitle: _____,
    metaDescription: ______,
    translations: _______,
    image,
    ...item
  } = productIn(product, catalog.locale)

  return {
    ...item,
    categorySlug: categorySlugIn(catalog, product.categorySlug),
    image: toImageView(options.mediaBaseUrl, image, 'product'),
    attributes: attributeValuesOf(product, catalog.attributes),
  }
}

/** Arbre des catégories dans la langue demandée, chaque nœud avec ses versions dans les langues activées. */
const toCategoryNodes = (
  tree: CategoryTree,
  parent: Catalog.Category | null,
  locale: RequestLocale,
): CategoryNode[] =>
  CategoryTree.childrenOf(tree, parent).map((category) => {
    const { slug, name } = categoryIn(category, locale.current)
    return {
      slug,
      name,
      parent: parent === null ? null : categoryIn(parent, locale.current).slug,
      children: toCategoryNodes(tree, category, locale),
      alternates: alternates(locale, (other) => categoryIn(category, other).slug),
    }
  })

const toProductFacets = ({ totalItems, facets }: Catalog.ProductList) => ({
  totalItems,
  ...facets,
})

export const catalogRoutes = (repositories: CatalogRepositories, options: RouteOptions) => {
  const search = (url: string, locale: string) =>
    searchProducts(parseCriteria(rawCriteriaFromQuery(new URL(url).search)), repositories, locale)

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
      async (c) => {
        const tree = CategoryTree.of(await repositories.categories.findAll())
        return c.json(toCategoryNodes(tree, null, await options.contentLocale(c.req.raw)), 200)
      },
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
        const { current } = await options.contentLocale(c.req.raw)
        const { items } = await search(c.req.url, current)
        const catalog = await catalogIn(repositories, current)

        return c.json(
          items.map((product) => toProductItem(product, catalog, options)),
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
      async (c) => {
        const { current } = await options.contentLocale(c.req.raw)
        return c.json(toProductFacets(await search(c.req.url, current)), 200)
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
        const locale = await options.contentLocale(c.req.raw)
        const product = await repositories.products.findBySlug(
          c.req.valid('param').slug,
          locale.current,
        )
        if (product === null) {
          throw new HTTPException(404, { message: 'Not Found' })
        }
        const catalog = await catalogIn(repositories, locale.current)
        const categoryPath = CategoryTree.pathTo(catalog.tree, product.categorySlug).map((slug) => {
          const { slug: translatedSlug, name } = categoryIn(
            CategoryTree.find(catalog.tree, slug),
            locale.current,
          )
          return { slug: translatedSlug, name }
        })
        const translated = productIn(product, locale.current)

        return c.json(
          {
            ...toProductItem(product, catalog, options),
            categoryPath,
            description: translated.description,
            gallery: translated.gallery.map((image) =>
              imageView(options.mediaBaseUrl, image, 'product'),
            ),
            metaTitle: translated.metaTitle,
            metaDescription: translated.metaDescription,
            alternates: alternates(locale, (other) => productIn(product, other).slug),
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
      // Ordre du nom dans la langue par défaut, quelle que soit la langue demandée
      async (c) => {
        const { current } = await options.contentLocale(c.req.raw)
        const products = await repositories.products.findFeatured()
        const catalog = await catalogIn(repositories, current)
        return c.json(
          products.map((product) => toProductItem(product, catalog, options)),
          200,
        )
      },
    )
}
