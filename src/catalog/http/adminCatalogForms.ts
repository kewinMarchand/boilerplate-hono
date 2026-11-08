import {
  field,
  integer,
  readMetaFields,
  requiredText,
  slugField,
} from '#/shared/http/adminForms.ts'

import { isExposure, isSize } from '#/catalog/domain/catalog.ts'
import { Price } from '#/catalog/domain/price.ts'
import { readImageFields } from '#/media/http/adminImageFields.ts'

import { readGalleryRows } from './adminGalleryFields.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

const DESCRIPTION_MAX_LENGTH = 2000
/** Champ d'un attribut configurable : `attributes[<code>]` ; la valeur est contrôlée par le cas d'usage. */
const ATTRIBUTE_FIELD = /^attributes\[([^\]]+)\]$/

/**
 * Lecture des formulaires de l'admin du catalogue : la forme est vérifiée ici, à la frontière
 * (outils communs de shared/http/adminForms.ts) ; les règles du catalogue le sont ensuite par les
 * cas d'usage.
 */
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

export const readProductForm = async (
  body: Record<string, unknown>,
): Promise<FormResult<Catalog.ProductInput>> => {
  const values = {
    name: field(body, 'name'),
    slug: field(body, 'slug'),
    categorySlug: field(body, 'categorySlug'),
    price: field(body, 'price'),
    exposure: field(body, 'exposure'),
    size: field(body, 'size'),
    inStock: field(body, 'inStock') === '' ? '' : 'on',
    featured: field(body, 'featured') === '' ? '' : 'on',
    // Fins de ligne du formulaire (CRLF) ramenées à LF, comme Product dans l'API Platform
    description: field(body, 'description').replaceAll('\r\n', '\n'),
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
  if (Array.from(values.description).length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Cette chaîne est trop longue. Elle doit avoir au maximum ${DESCRIPTION_MAX_LENGTH} caractères.`
  }
  const attributeFields = Object.keys(body).flatMap((key) => {
    const code = ATTRIBUTE_FIELD.exec(key)?.[1]
    return code === undefined ? [] : [{ key, code, value: field(body, key) }]
  })
  const attributeValues = Object.fromEntries(
    attributeFields.map(({ code, value }) => [code, value]),
  )
  const formValues: Values = {
    ...values,
    ...Object.fromEntries(attributeFields.map(({ key, value }) => [key, value])),
  }
  const image = await readImageFields(body, formValues, errors)
  const gallery = await readGalleryRows(body, formValues, errors)
  const meta = readMetaFields(body, formValues, errors)
  const { exposure, size } = values
  const data =
    Object.keys(errors).length === 0 && cents !== null && isExposure(exposure) && isSize(size)
      ? {
          slug: values.slug,
          name: values.name,
          categorySlug: values.categorySlug,
          price: Price.fromCents(cents),
          exposure,
          size,
          inStock: values.inStock === 'on',
          featured: values.featured === 'on',
          description: values.description,
          imageContent: image.content,
          imageAlt: image.alt,
          imageDecorative: image.decorative,
          attributeValues,
          gallery,
          metaTitle: meta.title,
          metaDescription: meta.description,
        }
      : null

  return { values: formValues, errors, data }
}
