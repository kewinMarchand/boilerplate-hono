import { describe, expect, it } from 'vitest'

import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { rawCriteriaFromQuery } from '#/catalog/http/productQuery.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

const NONE: Catalog.RawCriteria = {
  category: undefined,
  exposure: [],
  size: [],
  priceMin: undefined,
  priceMax: undefined,
  inStock: undefined,
  orderPrice: undefined,
  orderName: undefined,
  page: undefined,
  itemsPerPage: undefined,
  attributes: new Map(),
}

describe('parseCriteria', () => {
  it('applique les valeurs par défaut', () => {
    expect(parseCriteria(NONE)).toEqual({
      category: null,
      exposures: [],
      sizes: [],
      priceMin: null,
      priceMax: null,
      inStockOnly: false,
      sort: null,
      page: 1,
      itemsPerPage: 12,
      attributes: new Map(),
    })
  })

  it('ignore les valeurs invalides', () => {
    const criteria = parseCriteria({
      ...NONE,
      exposure: ['lune', 'ombre'],
      size: ['XL'],
      priceMin: 'abc',
      priceMax: '-1',
      inStock: 'TRUE',
      orderPrice: 'ASC',
      page: '0',
      itemsPerPage: '49',
    })
    expect(criteria).toMatchObject({
      exposures: ['ombre'],
      sizes: [],
      priceMin: null,
      priceMax: null,
      inStockOnly: false,
      sort: null,
      page: 1,
      itemsPerPage: 12,
    })
  })

  it('borne la page à 1 000 000', () => {
    expect(parseCriteria({ ...NONE, page: '99999999999999999999' }).page).toBe(1_000_000)
  })

  it('donne la priorité au tri par prix', () => {
    expect(parseCriteria({ ...NONE, orderPrice: 'desc', orderName: 'asc' }).sort).toBe('price-desc')
    expect(parseCriteria({ ...NONE, orderName: 'asc' }).sort).toBe('name-asc')
  })

  it('accepte true ou 1 pour le stock et les zéros de tête', () => {
    expect(parseCriteria({ ...NONE, inStock: '1', priceMin: '05000' })).toMatchObject({
      inStockOnly: true,
      priceMin: 5000,
    })
  })
})

describe('rawCriteriaFromQuery', () => {
  it('lit les clés répétées, scalaires et entre crochets', () => {
    expect(
      rawCriteriaFromQuery('?exposure=ombre&size[]=S&size[]=M&order[price]=asc&category[]=x'),
    ).toMatchObject({
      exposure: ['ombre'],
      size: ['S', 'M'],
      orderPrice: 'asc',
      category: undefined,
    })
  })

  it('lit les attributs demandés par code, une valeur seule ou une liste, chaînes seulement', () => {
    expect(
      rawCriteriaFromQuery(
        'attributes[feuillage][]=persistant&attributes[feuillage][]=caduc&attributes[port]=dresse&attributes[hauteur][][]=1&attributes[]=y',
      ).attributes,
    ).toEqual(
      new Map([
        ['feuillage', ['persistant', 'caduc']],
        ['port', ['dresse']],
        ['hauteur', []],
        ['0', ['y']],
      ]),
    )
    expect(rawCriteriaFromQuery('attributes=feuillage').attributes).toEqual(new Map())
  })
})
