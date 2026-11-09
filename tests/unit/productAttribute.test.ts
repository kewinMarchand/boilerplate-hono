import { describe, expect, it } from 'vitest'

import { CatalogRuleViolation } from '#/catalog/domain/catalogRules.ts'
import {
  attributeValueFor,
  attributeValuesOf,
  isFacet,
  productAttribute,
} from '#/catalog/domain/productAttribute.ts'
import { productFixtures } from '#/catalog/infrastructure/catalogFixtures.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

const input = (
  type: Catalog.AttributeType,
  choices: Catalog.AttributeChoice[] = [],
  filterable = false,
) => ({ label: 'Attribut', type, unit: '', filterable, position: 1, choices })

const foliage = productAttribute(
  'feuillage',
  {
    ...input('choice', [
      { value: 'persistant', label: 'Persistant' },
      { value: 'caduc', label: 'Caduc' },
    ]),
    label: 'Feuillage',
    filterable: true,
  },
  {},
)
const height = productAttribute('hauteur', { ...input('number'), unit: 'cm' }, {})

describe('attribut configurable (règles de ProductAttribute)', () => {
  it('garde ses valeurs dans l’ordre et sert de facette', () => {
    expect(foliage.choices.map(({ value }) => value)).toEqual(['persistant', 'caduc'])
    expect(isFacet(foliage)).toBe(true)
    expect(isFacet(height)).toBe(false)
  })

  it.each([
    [
      input('choice', [
        { value: 'caduc', label: 'Caduc' },
        { value: 'caduc', label: 'Caduque' },
      ]),
      'La valeur « caduc » est en double.',
    ],
    [
      input('number', [{ value: 'grand', label: 'Grand' }]),
      'Seul un attribut de type liste a des valeurs.',
    ],
    [input('text', [], true), 'Seul un attribut de type liste peut servir de filtre au catalogue.'],
  ])('refuse une définition incohérente', (definition, message) => {
    expect(() => productAttribute('x', definition, {})).toThrow(new CatalogRuleViolation(message))
  })

  it('ramène une unité vide à null', () => {
    expect(productAttribute('origine', input('text'), {}).unit).toBeNull()
    expect(height.unit).toBe('cm')
  })

  it('contrôle la valeur d’un produit', () => {
    expect(attributeValueFor(foliage, 'persistant')).toBe('persistant')
    expect(attributeValueFor(height, ' 12.5 ')).toBe('12.5')
    expect(attributeValueFor(height, '')).toBeNull()
    expect(attributeValueFor(height, undefined)).toBeNull()
    expect(() => attributeValueFor(foliage, 'epineux')).toThrow(
      "« epineux » n'est pas une valeur de l'attribut « Feuillage ».",
    )
  })

  it('liste les attributs renseignés d’un produit par position, avec le libellé de la valeur', () => {
    const [monstera] = productFixtures

    expect(
      monstera && attributeValuesOf({ ...monstera, image: null, gallery: [] }, [foliage, height]),
    ).toEqual([
      {
        code: 'feuillage',
        label: 'Feuillage',
        type: 'choice',
        value: 'persistant',
        valueLabel: 'Persistant',
        unit: null,
      },
    ])
  })
})
