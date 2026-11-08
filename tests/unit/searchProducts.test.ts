import { describe, expect, it } from 'vitest'

import { CategoryNotFoundError } from '#/catalog/domain/CategoryNotFoundError.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { searchProducts } from '#/catalog/application/searchProducts.ts'
import {
  categoryFixtures,
  productAttributeFixtures,
  productFixtures,
} from '#/catalog/infrastructure/catalogFixtures.ts'
import { rawCriteriaFromQuery } from '#/catalog/http/productQuery.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

const repositories = () => {
  const queries: Catalog.SearchQuery[] = []
  const products: Catalog.ProductRepository = {
    search: (query) => {
      queries.push(query)
      return Promise.resolve({
        items: productFixtures
          .slice(0, 2)
          .map(({ demoImage: _, galleryImages: __, ...product }) => ({
            ...product,
            image: null,
            gallery: [],
          })),
        totalItems: 3,
        exposureCounts: { 'mi-ombre': 3 },
        sizeCounts: {},
        categoryCounts: {},
        attributeCounts: new Map(),
      })
    },
    findBySlug: () => Promise.resolve(null),
    findFeatured: () => Promise.resolve([]),
  }
  const categories: Catalog.CategoryRepository = {
    findAll: () => Promise.resolve(categoryFixtures),
  }

  const attributes: Catalog.ProductAttributeRepository = {
    findAll: () => Promise.resolve(productAttributeFixtures),
  }

  return { queries, repositories: { categories, products, attributes } }
}

const criteria = (query: string) => parseCriteria(rawCriteriaFromQuery(query))

describe('searchProducts (cas d’utilisation)', () => {
  it('résout la branche et passe ses enfants directs au dépôt', async () => {
    const { queries, repositories: deps } = repositories()

    const list = await searchProducts(criteria('category=feuillages&itemsPerPage=2&page=2'), deps)

    expect(queries).toEqual([
      expect.objectContaining({
        branch: 'feuillages',
        children: ['monstera', 'fougeres'],
        skip: 2,
        limit: 2,
      }),
    ])
    expect(list.totalItems).toBe(3)
    expect(list.facets.category.map(({ slug, count }) => [slug, count])).toEqual([
      ['monstera', 0],
      ['fougeres', 0],
    ])
  })

  it('compte les catégories racines sans filtre de catégorie', async () => {
    const { queries, repositories: deps } = repositories()

    await searchProducts(criteria(''), deps)

    expect(queries[0]).toMatchObject({
      branch: null,
      children: ['plantes-interieur', 'plantes-exterieur', 'plantes-aquatiques'],
    })
  })

  it('passe au dépôt les filtres et les facettes des attributs filtrables', async () => {
    const { queries, repositories: deps } = repositories()

    await searchProducts(
      criteria('attributes[feuillage][]=caduc&attributes[hauteur-adulte][]=300'),
      deps,
    )

    expect(queries[0]).toMatchObject({
      attributeFilters: new Map([['feuillage', ['caduc']]]),
      attributeFacets: ['feuillage'],
    })
  })

  it('lève CategoryNotFoundError sans interroger le dépôt de produits', async () => {
    const { queries, repositories: deps } = repositories()

    await expect(searchProducts(criteria('category=cactus'), deps)).rejects.toThrow(
      CategoryNotFoundError,
    )
    expect(queries).toEqual([])
  })
})
