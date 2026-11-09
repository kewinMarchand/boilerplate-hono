import { CatalogRuleViolation } from './catalogRules.ts'

import type { Catalog } from './catalog.ts'
import type { Translations } from '#/shared/domain/translations.ts'

/**
 * Règles d'un attribut configurable (ADR 0006), mêmes messages que ProductAttribute de
 * l'API Platform. L'unicité du code et les valeurs encore portées par des produits se vérifient
 * dans les cas d'usage.
 */
export const ATTRIBUTE_TEXT_MAX_LENGTH = 120

const NUMBER = /^-?\d+(\.\d+)?$/

/**
 * Attribut enregistré : valeurs et filtre réservés au type « choice », valeurs sans doublon,
 * unité vide ramenée à null.
 */
export const productAttribute = (
  code: string,
  { label, type, unit, filterable, position, choices }: Omit<Catalog.ProductAttributeInput, 'code'>,
  translations: Translations,
): Catalog.ProductAttribute => {
  if (type !== 'choice' && choices.length > 0) {
    throw new CatalogRuleViolation('Seul un attribut de type liste a des valeurs.')
  }
  if (type !== 'choice' && filterable) {
    throw new CatalogRuleViolation(
      'Seul un attribut de type liste peut servir de filtre au catalogue.',
    )
  }
  const seen = new Set<string>()
  for (const { value } of choices) {
    if (seen.has(value)) {
      throw new CatalogRuleViolation('La valeur « %value% » est en double.', { value })
    }
    seen.add(value)
  }

  return {
    code,
    label,
    type,
    unit: unit === '' ? null : unit,
    filterable,
    position,
    choices: choices.map((choice) => ({ value: choice.value, label: choice.label })),
    translations,
  }
}

const choiceLabel = (attribute: Catalog.ProductAttribute, value: string): string | undefined =>
  attribute.choices.find((choice) => choice.value === value)?.label

/**
 * Valeur saisie pour un produit, contrôlée et sans espaces autour ; null si elle est vide
 * (attribut non renseigné).
 */
export const attributeValueFor = (
  attribute: Catalog.ProductAttribute,
  raw: string | undefined,
): string | null => {
  const value = (raw ?? '').trim()
  if (value === '') {
    return null
  }
  if (attribute.type === 'choice' && choiceLabel(attribute, value) === undefined) {
    throw new CatalogRuleViolation("« %value% » n'est pas une valeur de l'attribut « %label% ».", {
      value,
      label: attribute.label,
    })
  }
  if (attribute.type === 'number' && !NUMBER.test(value)) {
    throw new CatalogRuleViolation("L'attribut « %label% » attend un nombre.", {
      label: attribute.label,
    })
  }
  if (attribute.type === 'text' && Array.from(value).length > ATTRIBUTE_TEXT_MAX_LENGTH) {
    throw new CatalogRuleViolation("L'attribut « %label% » a %max% caractères au plus.", {
      label: attribute.label,
      max: ATTRIBUTE_TEXT_MAX_LENGTH,
    })
  }

  return value
}

/** Valeurs saisies pour un produit, contrôlées par leur définition ; un code sans définition est ignoré. */
export const checkAttributeValues = (
  attributes: readonly Catalog.ProductAttribute[],
  raw: Readonly<Record<string, string>>,
): Record<string, string> => {
  const values: Record<string, string> = {}
  for (const attribute of attributes) {
    const value = attributeValueFor(
      attribute,
      Object.hasOwn(raw, attribute.code) ? raw[attribute.code] : undefined,
    )
    if (value !== null) {
      values[attribute.code] = value
    }
  }

  return values
}

/** Facette du catalogue : un attribut de type liste marqué filtrable. */
export const isFacet = (attribute: Catalog.ProductAttribute): boolean =>
  attribute.type === 'choice' && attribute.filterable

/** Attributs renseignés sur un produit, dans l'ordre des définitions (par position). */
export const attributeValuesOf = (
  product: Catalog.Product,
  attributes: readonly Catalog.ProductAttribute[],
): Catalog.AttributeValue[] =>
  attributes.flatMap((attribute) => {
    const { code, label, type, unit } = attribute
    const value = Object.hasOwn(product.attributeValues, code)
      ? product.attributeValues[code]
      : undefined

    return value === undefined
      ? []
      : [{ code, label, type, value, valueLabel: choiceLabel(attribute, value) ?? value, unit }]
  })
