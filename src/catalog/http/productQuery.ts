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

/**
 * `attributes[<code>][]=<valeur>` ; une valeur seule (`attributes[<code>]=<valeur>`) est acceptée,
 * comme `exposure=ombre`. Un code numérique (clé entière en PHP) n'est jamais un code d'attribut :
 * la recherche l'ignore avec les autres codes inconnus.
 */
const attributeFilters = (value: PhpValue | undefined): Map<string, string[]> =>
  new Map(
    value instanceof Map ? [...value].map(([code, values]) => [code, list(values)] as const) : [],
  )

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
    attributes: attributeFilters(query.get('attributes')),
  }
}

interface ParameterSchema {
  readonly type: 'string' | 'integer' | 'boolean' | 'array' | 'object'
  readonly items?: { readonly type: 'string'; readonly enum: readonly string[] }
  readonly additionalProperties?: {
    readonly type: 'array'
    readonly items: { readonly type: 'string' }
  }
  readonly default?: number
  /** Forme du paramètre dans l'adresse (OpenAPI `style`, `explode`), hors du schéma. */
  readonly param?: { readonly style: 'deepObject'; readonly explode: boolean }
}

/** Style que l'API Platform publie pour ses paramètres tableau ou objet. */
const DEEP_OBJECT = { style: 'deepObject', explode: true } as const

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
    { type: 'array', items: { type: 'string', enum: EXPOSURES }, param: DEEP_OBJECT },
    'Expositions acceptées, clé répétée : exposure[]=soleil&exposure[]=ombre.',
  ),
  'size[]': parameter(
    { type: 'array', items: { type: 'string', enum: SIZES }, param: DEEP_OBJECT },
    'Tailles acceptées, clé répétée : size[]=S&size[]=M.',
  ),
  attributes: parameter(
    {
      type: 'object',
      additionalProperties: { type: 'array', items: { type: 'string' } },
      param: DEEP_OBJECT,
    },
    "Valeurs acceptées des attributs filtrables, par code, clé répétée : attributes[feuillage][]=persistant&attributes[feuillage][]=caduc. Valeurs d'un même attribut en OU, attributs entre eux en ET. Code ou valeur inconnus : ignorés. Les attributs filtrables et leurs valeurs : attributes de GET /api/product-facets.",
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
