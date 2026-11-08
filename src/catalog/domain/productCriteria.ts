import {
  DEFAULT_ITEMS_PER_PAGE,
  isExposure,
  isSize,
  MAX_ITEMS_PER_PAGE,
  MAX_PAGE,
} from './catalog.ts'
import { Price } from './price.ts'

import type { Catalog } from './catalog.ts'

const DIGITS = /^\d+$/

/** ctype_digit puis (int) de PHP : chiffres seulement, saturé au plus grand entier sûr. */
const toInteger = (value: string | undefined): number | null =>
  value !== undefined && DIGITS.test(value)
    ? Math.min(Number(value), Number.MAX_SAFE_INTEGER)
    : null

const toPrice = (value: string | undefined): Price | null => {
  const cents = toInteger(value)

  return cents === null ? null : Price.fromCents(cents)
}

const toSort = (raw: Catalog.RawCriteria): Catalog.Sort | null => {
  if (raw.orderPrice === 'asc' || raw.orderPrice === 'desc') {
    return `price-${raw.orderPrice}`
  }
  if (raw.orderName === 'asc' || raw.orderName === 'desc') {
    return `name-${raw.orderName}`
  }

  return null
}

/** Applique les règles de l'URL des fronts : toute valeur invalide est ignorée, sans erreur. */
export const parseCriteria = (raw: Catalog.RawCriteria): Catalog.Criteria => {
  const itemsPerPage = toInteger(raw.itemsPerPage)

  return {
    category: raw.category === undefined || raw.category === '' ? null : raw.category,
    exposures: raw.exposure.filter(isExposure),
    sizes: raw.size.filter(isSize),
    priceMin: toPrice(raw.priceMin),
    priceMax: toPrice(raw.priceMax),
    inStockOnly: raw.inStock === 'true' || raw.inStock === '1',
    sort: toSort(raw),
    page: Math.min(MAX_PAGE, Math.max(1, toInteger(raw.page) ?? 1)),
    itemsPerPage:
      itemsPerPage !== null && itemsPerPage >= 1 && itemsPerPage <= MAX_ITEMS_PER_PAGE
        ? itemsPerPage
        : DEFAULT_ITEMS_PER_PAGE,
    attributes: raw.attributes,
  }
}
