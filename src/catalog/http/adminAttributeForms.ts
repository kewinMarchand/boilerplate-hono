import { field, integer } from '#/shared/http/adminForms.ts'

import { isAttributeType } from '#/catalog/domain/catalog.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

/**
 * Formulaire d'un attribut configurable (ADR 0006) : forme vérifiée ici, avec les contraintes et
 * les messages de ProductAttributeType et AttributeChoiceType de l'API Platform ; les règles du
 * catalogue le sont ensuite par les cas d'usage.
 */
const CODE_PATTERN = /^[a-z][a-z0-9-]{0,39}$/
const VALUE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/
const LABEL_MAX_LENGTH = 60
const UNIT_MAX_LENGTH = 10
/** Lignes vides proposées sous les valeurs existantes : pas de JavaScript à maintenir. */
export const EMPTY_CHOICE_ROWS = 3

const NOT_BLANK = 'Cette valeur ne doit pas être vide.'
const tooLong = (max: number) =>
  `Cette chaîne est trop longue. Elle doit avoir au maximum ${max} caractères.`

/** Clé d'un champ de ligne de valeur : `choices[0][value]`, comme les noms du formulaire. */
export const choiceKey = (index: number, part: 'value' | 'label'): string =>
  `choices[${index}][${part}]`

const CHOICE_KEY = /^choices\[(\d+)\]\[(?:value|label)\]$/

/** Indices des lignes de valeurs parmi les clés d'un formulaire (envoyé ou à afficher), croissants. */
const choiceIndices = (fields: object): number[] =>
  [
    ...new Set(
      Object.keys(fields).flatMap((key) => {
        const index = CHOICE_KEY.exec(key)?.[1]
        return index === undefined ? [] : [Number(index)]
      }),
    ),
  ].sort((a, b) => a - b)

/** Nombre de lignes de valeurs d'un formulaire à afficher (numérotées à partir de 0). */
export const choiceRowCount = (values: Values): number => choiceIndices(values).length

const length = (value: string): number => Array.from(value).length

/** Lignes vides ajoutées sous les lignes existantes. */
export const withEmptyRows = (values: Values): Values => {
  const start = choiceRowCount(values)
  const rows: Values = {}
  for (let index = start; index < start + EMPTY_CHOICE_ROWS; index++) {
    rows[choiceKey(index, 'value')] = ''
    rows[choiceKey(index, 'label')] = ''
  }
  return { ...values, ...rows }
}

export const attributeValues = (attribute: Catalog.ProductAttribute): Values =>
  withEmptyRows({
    code: attribute.code,
    label: attribute.label,
    type: attribute.type,
    unit: attribute.unit ?? '',
    filterable: attribute.filterable ? 'on' : '',
    position: String(attribute.position),
    ...Object.fromEntries(
      attribute.choices.flatMap(({ value, label }, index) => [
        [choiceKey(index, 'value'), value],
        [choiceKey(index, 'label'), label],
      ]),
    ),
  })

/** `lockedCode` : code de l'attribut modifié, qui ne change plus (le champ n'est pas envoyé). */
export const readAttributeForm = (
  body: Record<string, unknown>,
  lockedCode: string | null,
): FormResult<Catalog.ProductAttributeInput> => {
  const values: Values = {
    code: lockedCode ?? field(body, 'code'),
    label: field(body, 'label'),
    type: field(body, 'type'),
    unit: field(body, 'unit'),
    filterable: field(body, 'filterable') === '' ? '' : 'on',
    position: field(body, 'position'),
  }
  // Lignes renumérotées dans l'ordre envoyé : seuls les indices présents sont lus
  const choices = choiceIndices(body).map((sent, index) => {
    const choice = {
      value: field(body, choiceKey(sent, 'value')),
      label: field(body, choiceKey(sent, 'label')),
    }
    values[choiceKey(index, 'value')] = choice.value
    values[choiceKey(index, 'label')] = choice.label
    return choice
  })

  const errors: Errors = {}
  if (lockedCode === null) {
    if (values.code === '') {
      errors.code = NOT_BLANK
    } else if (!CODE_PATTERN.test(values.code ?? '')) {
      errors.code =
        'Minuscules, chiffres et tirets, 40 caractères au plus, commence par une lettre.'
    }
  }
  const label = values.label ?? ''
  if (label === '') {
    errors.label = NOT_BLANK
  } else if (length(label) > LABEL_MAX_LENGTH) {
    errors.label = tooLong(LABEL_MAX_LENGTH)
  }
  const type = values.type ?? ''
  if (!isAttributeType(type)) {
    errors.type = "Le choix sélectionné n'est pas valide."
  }
  const unit = values.unit ?? ''
  if (length(unit) > UNIT_MAX_LENGTH) {
    errors.unit = tooLong(UNIT_MAX_LENGTH)
  }
  const position = integer(values.position ?? '')
  if (position === null) {
    errors.position = 'Cette valeur doit être un nombre entier.'
  } else if (position < 0) {
    errors.position = 'Cette valeur doit être positive ou nulle.'
  }
  choices.forEach((choice, index) => {
    if (choice.value !== '' && !VALUE_PATTERN.test(choice.value)) {
      errors[choiceKey(index, 'value')] =
        'Minuscules, chiffres et tirets, 40 caractères au plus, sans tiret au début.'
    }
    if (length(choice.label) > LABEL_MAX_LENGTH) {
      errors[choiceKey(index, 'label')] = tooLong(LABEL_MAX_LENGTH)
    }
  })

  const data =
    Object.keys(errors).length === 0 && position !== null && isAttributeType(type)
      ? {
          code: values.code ?? '',
          label,
          type,
          unit,
          filterable: values.filterable === 'on',
          position,
          choices,
        }
      : null

  return { values, errors, data }
}
