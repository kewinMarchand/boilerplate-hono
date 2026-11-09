import {
  field,
  integer,
  maxLength,
  META_DESCRIPTION_MAX_LENGTH,
  META_TITLE_MAX_LENGTH,
  readMetaFields,
  requiredText,
  slugField,
} from '#/shared/http/adminForms.ts'
import { t } from '#/shared/http/adminI18n.ts'
import { inLocale, otherLocales, readTranslations } from '#/shared/http/adminTranslations.ts'

import { isExposure, isSize } from '#/catalog/domain/catalog.ts'
import { Price } from '#/catalog/domain/price.ts'
import { readImageFields } from '#/media/http/adminImageFields.ts'

import { galleryAltField, galleryKeys, readGalleryRows } from './adminGalleryFields.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

const DESCRIPTION_MAX_LENGTH = 2000

/** Champs traduisibles des formulaires (ADR 0014), dans l'ordre des onglets de langue. */
export const CATEGORY_TRANSLATED = ['name', 'slug'] as const
export const PRODUCT_TRANSLATED = [
  'name',
  'slug',
  'description',
  'imageAlt',
  'metaTitle',
  'metaDescription',
] as const

/** Longueurs maximales des champs traduits, celles des champs de la langue par défaut. */
const PRODUCT_MAX_LENGTHS: Readonly<Record<string, number>> = {
  name: 255,
  description: DESCRIPTION_MAX_LENGTH,
  imageAlt: 255,
  metaTitle: META_TITLE_MAX_LENGTH,
  metaDescription: META_DESCRIPTION_MAX_LENGTH,
}
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

export const readCategoryForm = (
  body: Record<string, unknown>,
): FormResult<Catalog.CategoryInput> => {
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
    errors.position = t('validator.integer')
  } else if (position < 0) {
    errors.position = t('validator.positive_or_zero')
  }
  const formValues: Values = { ...values }
  const translations = readTranslations(body, CATEGORY_TRANSLATED, formValues, errors)
  const data =
    Object.keys(errors).length === 0 && position !== null
      ? {
          slug: values.slug,
          name: values.name,
          position,
          parent: values.parent === '' ? null : values.parent,
          ...(translations === undefined ? {} : { translations }),
        }
      : null

  return { values: formValues, errors, data }
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
    errors.categorySlug = t('constraint.category')
  }
  const cents = euroCents(values.price)
  if (cents === null) {
    errors.price = t('validator.money')
  } else if (cents < 0) {
    errors.price = t('constraint.price')
  }
  if (!isExposure(values.exposure)) {
    errors.exposure = t('validator.choice')
  }
  if (!isSize(values.size)) {
    errors.size = t('validator.choice')
  }
  maxLength(errors, 'description', values.description, DESCRIPTION_MAX_LENGTH)
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
  const translations = readTranslations(
    body,
    [...PRODUCT_TRANSLATED, ...galleryKeys(formValues).map(galleryAltField)],
    formValues,
    errors,
  )
  for (const locale of otherLocales()) {
    for (const [name, max] of Object.entries(PRODUCT_MAX_LENGTHS)) {
      const key = inLocale(locale, name)
      maxLength(errors, key, formValues[key] ?? '', max)
    }
  }
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
          ...(translations === undefined ? {} : { translations }),
        }
      : null

  return { values: formValues, errors, data }
}
