import { z } from 'zod'

import { parsePhpQuery, readPhpParameter } from '#/shared/http/phpQuery.ts'

import {
  DEFAULT_ITEMS_PER_PAGE,
  EXPOSURES,
  MAX_ITEMS_PER_PAGE,
  SIZES,
} from '#/catalog/domain/catalog.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { PhpValue } from '#/shared/http/phpQuery.ts'

const scalar = (value: PhpValue | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined

/** castToArray d'API Platform : `exposure=x` et `exposure[]=x` donnent tous deux une liste. */
const list = (value: PhpValue | undefined): string[] => {
  if (value === undefined) {
    return []
  }
  const values = typeof value === 'string' ? [value] : [...value.values()]

  return values.filter((item) => typeof item === 'string')
}

export const rawCriteriaFromQuery = (search: string): Catalog.RawCriteria => {
  const query = parsePhpQuery(search)
  const read = (key: string): string | undefined => scalar(readPhpParameter(query, key))

  return {
    category: read('category'),
    exposure: list(query.get('exposure')),
    size: list(query.get('size')),
    priceMin: read('priceMin'),
    priceMax: read('priceMax'),
    inStock: read('inStock'),
    orderPrice: read('order[price]'),
    orderName: read('order[name]'),
    page: read('page'),
    itemsPerPage: read('itemsPerPage'),
  }
}

interface ParameterSchema {
  readonly type: 'string' | 'integer' | 'boolean' | 'array'
  readonly items?: { readonly type: 'string'; readonly enum: readonly string[] }
  readonly default?: number
}

const parameter = (schema: ParameterSchema, description: string) =>
  z
    .unknown()
    .optional()
    .meta({ ...schema, description })

/**
 * Paramètres tels que publiés dans l'OpenAPI (mêmes noms, types et descriptions que
 * l'API Platform), sans validation : `z.unknown()` laisse passer toute valeur, car la règle
 * est d'ignorer une valeur invalide. La lecture réelle passe par rawCriteriaFromQuery
 * (sémantique PHP de la query string) puis parseCriteria (domaine).
 */
export const productQueryDocumentation = z.object({
  category: parameter(
    { type: 'string' },
    'Slug de catégorie : inclut toute la branche. Slug inconnu : 404.',
  ),
  'exposure[]': parameter(
    { type: 'array', items: { type: 'string', enum: EXPOSURES } },
    'Expositions acceptées, clé répétée : exposure[]=soleil&exposure[]=ombre.',
  ),
  'size[]': parameter(
    { type: 'array', items: { type: 'string', enum: SIZES } },
    'Tailles acceptées, clé répétée : size[]=S&size[]=M.',
  ),
  priceMin: parameter({ type: 'integer' }, 'Prix minimum inclus, en centimes.'),
  priceMax: parameter({ type: 'integer' }, 'Prix maximum inclus, en centimes.'),
  inStock: parameter({ type: 'boolean' }, 'true : uniquement les produits en stock.'),
  'order[price]': parameter(
    { type: 'string' },
    'Tri par prix, asc ou desc. Prioritaire sur order[name]. Sans tri : ordre de pertinence.',
  ),
  'order[name]': parameter(
    { type: 'string' },
    'Tri alphabétique (collation française), asc ou desc.',
  ),
  page: parameter(
    { type: 'integer', default: 1 },
    'Numéro de page, à partir de 1. Au-delà de la dernière page : tableau vide.',
  ),
  itemsPerPage: parameter(
    { type: 'integer', default: DEFAULT_ITEMS_PER_PAGE },
    `Produits par page, de 1 à ${MAX_ITEMS_PER_PAGE}.`,
  ),
})

export const productFacetsQueryDocumentation = productQueryDocumentation.omit({
  'order[price]': true,
  'order[name]': true,
  page: true,
  itemsPerPage: true,
})
