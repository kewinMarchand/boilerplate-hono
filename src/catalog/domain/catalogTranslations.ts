import { switchDefaultLocale, translated } from '#/shared/domain/translations.ts'

import type { Catalog } from './catalog.ts'

/** Clé de traduction du texte de remplacement d'une image de la galerie (ADR 0014). */
export const GALLERY_ALT = 'galleryAlt.'
/** Clé de traduction du libellé d'une valeur d'attribut. */
export const CHOICE_LABEL = 'choice.'

/**
 * Lectures dans une langue (ADR 0014) : chaque champ traduisible prend sa traduction, ou la valeur
 * de la langue par défaut (repli champ par champ). Locale null : la langue par défaut.
 */
export const categoryIn = (
  category: Catalog.Category,
  locale: string | null,
): Catalog.Category => ({
  ...category,
  slug: translated(category.translations, 'slug', category.slug, locale),
  name: translated(category.translations, 'name', category.name, locale),
})

/** Une image décorative (texte vide) le reste dans toutes les langues. */
const altIn = (
  product: Catalog.Product,
  field: string,
  alt: string,
  locale: string | null,
): string => (alt === '' ? '' : translated(product.translations, field, alt, locale))

/** Le slug de catégorie reste celui de la langue par défaut : l'arbre le traduit. */
export const productIn = (product: Catalog.Product, locale: string | null): Catalog.Product => {
  const text = (field: 'slug' | 'name' | 'description' | 'metaTitle' | 'metaDescription') =>
    translated(product.translations, field, product[field], locale)

  return {
    ...product,
    slug: text('slug'),
    name: text('name'),
    description: text('description'),
    metaTitle: text('metaTitle'),
    metaDescription: text('metaDescription'),
    image:
      product.image === null
        ? null
        : { ...product.image, alt: altIn(product, 'imageAlt', product.image.alt, locale) },
    gallery: product.gallery.map((image) => ({
      ...image,
      alt: altIn(product, `${GALLERY_ALT}${image.key}`, image.alt, locale),
    })),
  }
}

export const attributeIn = (
  attribute: Catalog.ProductAttribute,
  locale: string | null,
): Catalog.ProductAttribute => {
  const unit = translated(attribute.translations, 'unit', attribute.unit ?? '', locale)
  return {
    ...attribute,
    label: translated(attribute.translations, 'label', attribute.label, locale),
    unit: unit === '' ? null : unit,
    choices: attribute.choices.map((choice) => ({
      ...choice,
      label: translated(
        attribute.translations,
        `${CHOICE_LABEL}${choice.value}`,
        choice.label,
        locale,
      ),
    })),
  }
}

/**
 * Nouvelle langue par défaut (ADR 0014) : les traductions de `to` passent dans les champs, les
 * textes actuels deviennent la traduction de `from`.
 */
export const switchCategoryLocale = (
  category: Catalog.Category,
  from: string,
  to: string,
): Catalog.Category => {
  const { texts, translations } = switchDefaultLocale(
    { slug: category.slug, name: category.name },
    category.translations,
    from,
    to,
  )
  return { ...category, ...texts, translations }
}

export const switchProductLocale = (
  product: Catalog.Product,
  from: string,
  to: string,
): Catalog.Product => {
  const current: Record<string, string> = {
    slug: product.slug,
    name: product.name,
    description: product.description,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    imageAlt: product.image?.alt ?? '',
  }
  for (const { key, alt } of product.gallery) {
    current[`${GALLERY_ALT}${key}`] = alt
  }
  const { texts, translations } = switchDefaultLocale(current, product.translations, from, to)
  const text = (field: string, fallback: string): string => texts[field] ?? fallback

  return {
    ...product,
    slug: text('slug', product.slug),
    name: text('name', product.name),
    description: text('description', product.description),
    metaTitle: text('metaTitle', product.metaTitle),
    metaDescription: text('metaDescription', product.metaDescription),
    image:
      product.image === null
        ? null
        : { ...product.image, alt: text('imageAlt', product.image.alt) },
    gallery: product.gallery.map((image) => ({
      ...image,
      alt: text(`${GALLERY_ALT}${image.key}`, image.alt),
    })),
    translations,
  }
}

export const switchAttributeLocale = (
  attribute: Catalog.ProductAttribute,
  from: string,
  to: string,
): Catalog.ProductAttribute => {
  const current: Record<string, string> = { label: attribute.label, unit: attribute.unit ?? '' }
  for (const { value, label } of attribute.choices) {
    current[`${CHOICE_LABEL}${value}`] = label
  }
  const { texts, translations } = switchDefaultLocale(current, attribute.translations, from, to)
  const unit = texts['unit'] ?? ''

  return {
    ...attribute,
    label: texts['label'] ?? attribute.label,
    unit: unit === '' ? null : unit,
    choices: attribute.choices.map((choice) => ({
      ...choice,
      label: texts[`${CHOICE_LABEL}${choice.value}`] ?? choice.label,
    })),
    translations,
  }
}
