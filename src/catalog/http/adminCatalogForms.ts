import { isExposure, isSize } from '#/catalog/domain/catalog.ts'
import { IMAGE_COUNT, SLUG_PATTERN } from '#/catalog/domain/catalogRules.ts'
import { Price } from '#/catalog/domain/price.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

/**
 * Lecture des formulaires de l'admin du catalogue : la forme (champs obligatoires, longueurs,
 * slug, nombres) est vérifiée ici, à la frontière, avec les messages de Symfony des formulaires de
 * l'API Platform ; les règles du catalogue sont vérifiées ensuite par les cas d'usage.
 */
export type Values = Record<string, string>
export type Errors = Record<string, string>

export interface FormResult<T> {
  readonly values: Values
  readonly errors: Errors
  readonly data: T | null
}

const MAX_LENGTH = 255

const field = (body: Record<string, unknown>, name: string): string => {
  const value = body[name]
  return typeof value === 'string' ? value.trim() : ''
}

const requiredText = (errors: Errors, name: string, value: string): void => {
  if (value === '') {
    errors[name] = 'Cette valeur ne doit pas être vide.'
  } else if (Array.from(value).length > MAX_LENGTH) {
    errors[name] =
      `Cette chaîne est trop longue. Elle doit avoir au maximum ${MAX_LENGTH} caractères.`
  }
}

const slugField = (errors: Errors, value: string): void => {
  requiredText(errors, 'slug', value)
  if (errors.slug === undefined && !SLUG_PATTERN.test(value)) {
    errors.slug = 'Minuscules, chiffres et tirets seulement.'
  }
}

const integer = (value: string): number | null => (/^-?\d+$/.test(value) ? Number(value) : null)

/** Euros saisis (« 34,90 », « 34.9 », « 35 ») en centimes, null si ce n'est pas un montant. */
export const euroCents = (value: string): number | null => {
  const match = /^(-?\d+)(?:[.,](\d{1,2}))?$/.exec(value.replace(/\s/g, ''))
  if (match === null) {
    return null
  }
  const [, euros = '0', cents = ''] = match
  const sign = euros.startsWith('-') ? -1 : 1

  return sign * (Math.abs(Number(euros)) * 100 + Number(cents.padEnd(2, '0')))
}

/** Centimes affichés dans le formulaire : « 34,90 ». */
export const centsToEuros = (cents: number): string =>
  `${Math.trunc(cents / 100)},${String(Math.abs(cents) % 100).padStart(2, '0')}`

export const readCategoryForm = (body: Record<string, unknown>): FormResult<Catalog.Category> => {
  const values = {
    name: field(body, 'name'),
    slug: field(body, 'slug'),
    position: field(body, 'position'),
    parent: field(body, 'parent'),
  }
  const errors: Errors = {}
  requiredText(errors, 'name', values.name)
  slugField(errors, values.slug)
  const position = integer(values.position)
  if (position === null) {
    errors.position = 'Cette valeur doit être un nombre entier.'
  } else if (position < 0) {
    errors.position = 'Cette valeur doit être positive ou nulle.'
  }
  const data =
    Object.keys(errors).length === 0 && position !== null
      ? {
          slug: values.slug,
          name: values.name,
          position,
          parent: values.parent === '' ? null : values.parent,
        }
      : null

  return { values, errors, data }
}

export const readProductForm = (
  body: Record<string, unknown>,
): FormResult<Catalog.ProductInput> => {
  const values = {
    name: field(body, 'name'),
    slug: field(body, 'slug'),
    categorySlug: field(body, 'categorySlug'),
    price: field(body, 'price'),
    exposure: field(body, 'exposure'),
    size: field(body, 'size'),
    inStock: field(body, 'inStock') === '' ? '' : 'on',
    image: field(body, 'image'),
  }
  const errors: Errors = {}
  requiredText(errors, 'name', values.name)
  slugField(errors, values.slug)
  if (values.categorySlug === '') {
    errors.categorySlug = 'Choisir une catégorie.'
  }
  const cents = euroCents(values.price)
  if (cents === null) {
    errors.price = 'Veuillez saisir un montant valide.'
  } else if (cents < 0) {
    errors.price = 'Le prix ne peut pas être négatif.'
  }
  if (!isExposure(values.exposure)) {
    errors.exposure = "Le choix sélectionné n'est pas valide."
  }
  if (!isSize(values.size)) {
    errors.size = "Le choix sélectionné n'est pas valide."
  }
  const image = integer(values.image)
  if (image === null || image < 1 || image > IMAGE_COUNT) {
    errors.image = `Cette valeur doit être comprise entre 1 et ${IMAGE_COUNT}.`
  }
  const { exposure, size } = values
  const data =
    Object.keys(errors).length === 0 &&
    cents !== null &&
    image !== null &&
    isExposure(exposure) &&
    isSize(size)
      ? {
          slug: values.slug,
          name: values.name,
          categorySlug: values.categorySlug,
          price: Price.fromCents(cents),
          exposure,
          size,
          inStock: values.inStock === 'on',
          image,
        }
      : null

  return { values, errors, data }
}
