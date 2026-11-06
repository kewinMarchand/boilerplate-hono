import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { productListContract } from '#/catalog/http/contract.ts'

import { createTestContext, demoView, getJson } from './context.ts'

import type { TestContext } from './context.ts'
import type { z } from 'zod'

type ProductList = z.infer<typeof productListContract>

let context: TestContext

beforeAll(async () => {
  context = await createTestContext('products')
})
afterAll(() => context.close())

const products = async (query: string): Promise<ProductList> => {
  const { response, body } = await getJson(context, `/api/products?${query}`)
  expect(response.status).toBe(200)

  return productListContract.parse(body)
}

const counts = (facets: ProductList['facets']['exposure']) =>
  Object.fromEntries(facets.map(({ value, count }) => [value, count]))

const categoryCounts = (list: ProductList) =>
  Object.fromEntries(list.facets.category.map(({ slug, count }) => [slug, count]))

const pagination = ({ totalItems, page, itemsPerPage, totalPages }: ProductList) => ({
  totalItems,
  page,
  itemsPerPage,
  totalPages,
})

describe('GET /api/products (scénarios de ProductApiTest)', () => {
  it('liste la première page, les totaux et les facettes sans filtre', async () => {
    const list = await products('')

    expect(list.items).toHaveLength(12)
    expect(pagination(list)).toEqual({ totalItems: 24, page: 1, itemsPerPage: 12, totalPages: 2 })
    expect(list.items[0]).toEqual({
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
    expect(counts(list.facets.exposure)).toEqual({ soleil: 14, 'mi-ombre': 7, ombre: 3 })
    expect(counts(list.facets.size)).toEqual({ S: 6, M: 9, L: 9 })
    expect(categoryCounts(list)).toEqual({
      'plantes-interieur': 12,
      'plantes-exterieur': 9,
      'plantes-aquatiques': 3,
    })
  })

  it('inclut toute la branche et liste ses enfants directs', async () => {
    const interior = await products('category=plantes-interieur')
    expect(interior.totalItems).toBe(12)
    expect(categoryCounts(interior)).toEqual({ feuillages: 6, 'plantes-a-fleurs': 6 })

    const leaves = await products('category=feuillages')
    expect(categoryCounts(leaves)).toEqual({ monstera: 3, fougeres: 3 })
    expect(counts(leaves.facets.exposure)).toEqual({ soleil: 0, 'mi-ombre': 4, ombre: 2 })

    expect((await products('category=monstera')).facets.category).toEqual([])
  })

  it('répond 404 avec le message français pour une catégorie inconnue', async () => {
    const { response, body } = await getJson(context, '/api/products?category=cactus')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(body).toEqual({
      title: 'An error occurred',
      detail: 'Catégorie introuvable : cactus',
      status: 404,
      type: '/errors/404',
    })
  })

  it('compte chaque facette sans ses propres filtres (disjonctif)', async () => {
    const shade = await products('exposure[]=ombre')
    expect(shade.totalItems).toBe(3)
    expect(counts(shade.facets.exposure)).toEqual({ soleil: 14, 'mi-ombre': 7, ombre: 3 })
    expect(counts(shade.facets.size)).toEqual({ S: 2, M: 1, L: 0 })

    const large = await products('size[]=L')
    expect(counts(large.facets.size)).toEqual({ S: 6, M: 9, L: 9 })
    expect(counts(large.facets.exposure)).toEqual({ soleil: 6, 'mi-ombre': 3, ombre: 0 })

    const combined = await products('exposure[]=soleil&size[]=S')
    expect(combined.totalItems).toBe(3)
    expect(counts(combined.facets.exposure)).toEqual({ soleil: 3, 'mi-ombre': 1, ombre: 2 })
    expect(counts(combined.facets.size)).toEqual({ S: 3, M: 5, L: 6 })

    expect((await products('exposure[]=ombre&exposure[]=mi-ombre')).totalItems).toBe(10)
  })

  it('filtre le prix en centimes, bornes incluses, et le stock', async () => {
    const range = await products('priceMin=2290&priceMax=2990')
    expect(range.items.map((item) => item.price)).toEqual([2490, 2690, 2990, 2290, 2490])

    const inStock = await products('inStock=true&itemsPerPage=48')
    expect(inStock.totalItems).toBe(19)
    expect(inStock.items.every((item) => item.inStock)).toBe(true)
  })

  it('trie par prix (stable) et par nom en collation française', async () => {
    expect(
      (await products('order[price]=asc')).items.slice(0, 2).map((item) => item.price),
    ).toEqual([1290, 1490])
    expect(
      (await products('order[price]=desc')).items.slice(0, 2).map((item) => item.price),
    ).toEqual([12900, 8990])
    expect((await products('order[name]=asc')).items[0]?.slug).toBe('anthurium-andreanum-rouge')
    expect((await products('order[name]=desc')).items[0]?.slug).toBe('strelitzia-reginae')
  })

  it('pagine', async () => {
    expect((await products('page=2')).items[0]?.id).toBe(13)
    const custom = await products('itemsPerPage=5&page=5')
    expect(pagination(custom)).toEqual({ totalItems: 24, page: 5, itemsPerPage: 5, totalPages: 5 })
    expect(custom.items).toHaveLength(4)
    expect((await products('page=3')).items).toEqual([])
  })

  it('ignore les valeurs invalides', async () => {
    const list = await products(
      'exposure[]=lune&size[]=XL&priceMin=abc&inStock=peut-etre&order[price]=haut&page=0&itemsPerPage=500',
    )
    expect(pagination(list)).toEqual({ totalItems: 24, page: 1, itemsPerPage: 12, totalPages: 2 })
    expect(list.items[0]?.id).toBe(1)
  })
})
