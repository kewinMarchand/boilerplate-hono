import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { productContract, productFacetsContract } from '#/catalog/http/contract.ts'

import { createTestContext, demoView, getJson } from './context.ts'

import type { TestContext } from './context.ts'

type ProductFacets = z.infer<typeof productFacetsContract>

let context: TestContext

beforeAll(async () => {
  context = await createTestContext('products')
})
afterAll(() => context.close())

const products = async (query: string) => {
  const { response, body } = await getJson(context, `/api/products?${query}`)
  expect(response.status).toBe(200)

  return z.array(productContract).parse(body)
}

const facets = async (query: string): Promise<ProductFacets> => {
  const { response, body } = await getJson(context, `/api/product-facets?${query}`)
  expect(response.status).toBe(200)

  return productFacetsContract.parse(body)
}

const counts = (values: ProductFacets['exposure']) =>
  Object.fromEntries(values.map(({ value, count }) => [value, count]))

const categoryCounts = ({ category }: ProductFacets) =>
  Object.fromEntries(category.map(({ slug, count }) => [slug, count]))

describe('GET /api/products et /api/product-facets (scénarios de ProductApiTest)', () => {
  it('liste la première page des produits sans filtre', async () => {
    const items = await products('')

    expect(items).toHaveLength(12)
    expect(items[0]).toEqual({
      id: 1,
      slug: 'monstera-deliciosa',
      name: 'Monstera deliciosa',
      categorySlug: 'monstera',
      price: 3490,
      exposure: 'mi-ombre',
      size: 'M',
      inStock: true,
      image: demoView('product-1', 'product', 'Monstera deliciosa'),
    })
  })

  it('compte tous les produits sans filtre', async () => {
    const all = await facets('')

    expect(all.totalItems).toBe(24)
    expect(counts(all.exposure)).toEqual({ soleil: 14, 'mi-ombre': 7, ombre: 3 })
    expect(counts(all.size)).toEqual({ S: 6, M: 9, L: 9 })
    expect(categoryCounts(all)).toEqual({
      'plantes-interieur': 12,
      'plantes-exterieur': 9,
      'plantes-aquatiques': 3,
    })
  })

  it('inclut toute la branche et liste ses enfants directs', async () => {
    const interior = await facets('category=plantes-interieur')
    expect(interior.totalItems).toBe(12)
    expect(await products('category=plantes-interieur&itemsPerPage=48')).toHaveLength(12)
    expect(categoryCounts(interior)).toEqual({ feuillages: 6, 'plantes-a-fleurs': 6 })

    const leaves = await facets('category=feuillages')
    expect(leaves.totalItems).toBe(6)
    expect(categoryCounts(leaves)).toEqual({ monstera: 3, fougeres: 3 })
    expect(counts(leaves.exposure)).toEqual({ soleil: 0, 'mi-ombre': 4, ombre: 2 })

    const leaf = await facets('category=monstera')
    expect(leaf.totalItems).toBe(3)
    expect(leaf.category).toEqual([])
  })

  it.each(['/api/products?category=cactus', '/api/product-facets?category=cactus'])(
    'répond 404 avec le message français pour une catégorie inconnue (%s)',
    async (path) => {
      const { response, body } = await getJson(context, path)

      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toBe('application/problem+json')
      expect(body).toEqual({
        title: 'An error occurred',
        detail: 'Catégorie introuvable : cactus',
        status: 404,
        type: '/errors/404',
      })
    },
  )

  it('compte chaque facette sans ses propres filtres (disjonctif)', async () => {
    const shade = await facets('exposure[]=ombre')
    expect(shade.totalItems).toBe(3)
    expect(await products('exposure[]=ombre')).toHaveLength(3)
    expect(counts(shade.exposure)).toEqual({ soleil: 14, 'mi-ombre': 7, ombre: 3 })
    expect(counts(shade.size)).toEqual({ S: 2, M: 1, L: 0 })
    expect(categoryCounts(shade)).toEqual({
      'plantes-interieur': 3,
      'plantes-exterieur': 0,
      'plantes-aquatiques': 0,
    })

    expect((await facets('exposure[]=ombre&exposure[]=mi-ombre')).totalItems).toBe(10)
    expect(await products('exposure[]=ombre&exposure[]=mi-ombre&itemsPerPage=48')).toHaveLength(10)

    const large = await facets('size[]=L')
    expect(large.totalItems).toBe(9)
    expect(counts(large.size)).toEqual({ S: 6, M: 9, L: 9 })
    expect(counts(large.exposure)).toEqual({ soleil: 6, 'mi-ombre': 3, ombre: 0 })

    const combined = await facets('exposure[]=soleil&size[]=S')
    expect(combined.totalItems).toBe(3)
    expect(counts(combined.exposure)).toEqual({ soleil: 3, 'mi-ombre': 1, ombre: 2 })
    expect(counts(combined.size)).toEqual({ S: 3, M: 5, L: 6 })
  })

  it('filtre le prix en centimes, bornes incluses, et le stock', async () => {
    expect((await products('priceMin=2290&priceMax=2990')).map((item) => item.price)).toEqual([
      2490, 2690, 2990, 2290, 2490,
    ])
    expect((await facets('priceMin=2290&priceMax=2990')).totalItems).toBe(5)

    expect((await facets('inStock=true')).totalItems).toBe(19)
    expect((await products('inStock=true&itemsPerPage=48')).every((item) => item.inStock)).toBe(
      true,
    )
  })

  it('trie par prix (stable) et par nom en collation française', async () => {
    expect((await products('order[price]=asc')).slice(0, 2).map((item) => item.price)).toEqual([
      1290, 1490,
    ])
    expect((await products('order[price]=desc')).slice(0, 2).map((item) => item.price)).toEqual([
      12900, 8990,
    ])
    expect((await products('order[name]=asc'))[0]?.slug).toBe('anthurium-andreanum-rouge')
    expect((await products('order[name]=desc'))[0]?.slug).toBe('strelitzia-reginae')
  })

  it('pagine', async () => {
    const second = await products('page=2')
    expect(second[0]?.id).toBe(13)
    expect(second).toHaveLength(12)

    expect(await products('itemsPerPage=5&page=5')).toHaveLength(4)
    expect(await products('page=3')).toEqual([])
  })

  it('ignore les valeurs invalides', async () => {
    const query =
      'exposure[]=lune&size[]=XL&priceMin=abc&inStock=peut-etre&order[price]=haut&page=0&itemsPerPage=500'

    const items = await products(query)
    expect(items).toHaveLength(12)
    expect(items[0]?.id).toBe(1)
    expect((await facets(query)).totalItems).toBe(24)

    expect(await products('page=99999999999999999999')).toEqual([])
  })
})
