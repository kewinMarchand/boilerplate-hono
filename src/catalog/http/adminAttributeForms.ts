import { field, integer } from '#/shared/http/adminForms.ts'
import { t } from '#/shared/http/adminI18n.ts'
import {
  inLocale,
  otherLocales,
  readTranslations,
  translationValues,
} from '#/shared/http/adminTranslations.ts'

import { isAttributeType } from '#/catalog/domain/catalog.ts'
import { CHOICE_LABEL } from '#/catalog/domain/catalogTranslations.ts'

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

const tooLong = (max: number) => t('validator.too_long', { max })

/** Champs traduisibles de l'attribut dans les onglets de langue ; les libellés des valeurs se traduisent dans leur ligne. */
export const ATTRIBUTE_TRANSLATED = ['label', 'unit'] as const

/** Clé d'un champ de ligne de valeur : `choices[0][value]`, comme les noms du formulaire. */
export const choiceKey = (index: number, part: 'value' | 'label'): string =>
  `choices[${index}][${part}]`

/** Libellé d'une valeur dans une langue traduite, dans sa ligne : `choices[0][translations][en]`. */
export const choiceTranslationKey = (index: number, locale: string): string =>
  `choices[${index}][translations][${locale}]`

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
    ...translationValues(attribute.translations, ATTRIBUTE_TRANSLATED),
    ...Object.fromEntries(
      attribute.choices.flatMap(({ value, label }, index): [string, string][] => [
        [choiceKey(index, 'value'), value],
        [choiceKey(index, 'label'), label],
        ...otherLocales().map((locale): [string, string] => [
          choiceTranslationKey(index, locale),
          attribute.translations[locale]?.[`${CHOICE_LABEL}${value}`] ?? '',
        ]),
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
  const rows = choiceIndices(body).map((sent, index) => {
    const choice = {
      value: field(body, choiceKey(sent, 'value')),
      label: field(body, choiceKey(sent, 'label')),
    }
    values[choiceKey(index, 'value')] = choice.value
    values[choiceKey(index, 'label')] = choice.label
    const labels = otherLocales().map((locale) => {
      const translated = field(body, choiceTranslationKey(sent, locale))
      values[choiceTranslationKey(index, locale)] = translated
      return [locale, translated] as const
    })
    return { choice, labels }
  })
  const choices = rows.map(({ choice }) => choice)

  const errors: Errors = {}
  if (lockedCode === null) {
    if (values.code === '') {
      errors.code = t('validator.not_blank')
    } else if (!CODE_PATTERN.test(values.code ?? '')) {
      errors.code = t('constraint.attribute_code')
    }
  }
  const label = values.label ?? ''
  if (label === '') {
    errors.label = t('validator.not_blank')
  } else if (length(label) > LABEL_MAX_LENGTH) {
    errors.label = tooLong(LABEL_MAX_LENGTH)
  }
  const type = values.type ?? ''
  if (!isAttributeType(type)) {
    errors.type = t('validator.choice')
  }
  const unit = values.unit ?? ''
  if (length(unit) > UNIT_MAX_LENGTH) {
    errors.unit = tooLong(UNIT_MAX_LENGTH)
  }
  const position = integer(values.position ?? '')
  if ((values.position ?? '') === '') {
    errors.position = t('validator.not_blank')
  } else if (position === null) {
    errors.position = t('validator.integer')
  } else if (position < 0) {
    errors.position = t('validator.positive_or_zero')
  }
  rows.forEach(({ choice, labels }, index) => {
    if (choice.value !== '' && !VALUE_PATTERN.test(choice.value)) {
      errors[choiceKey(index, 'value')] = t('constraint.choice_value')
    }
    if (length(choice.label) > LABEL_MAX_LENGTH) {
      errors[choiceKey(index, 'label')] = tooLong(LABEL_MAX_LENGTH)
    }
    for (const [locale, translated] of labels) {
      if (length(translated) > LABEL_MAX_LENGTH) {
        errors[choiceTranslationKey(index, locale)] = tooLong(LABEL_MAX_LENGTH)
      }
    }
  })
  const fields = readTranslations(body, ATTRIBUTE_TRANSLATED, values, errors)
  for (const locale of otherLocales()) {
    if (length(values[inLocale(locale, 'label')] ?? '') > LABEL_MAX_LENGTH) {
      errors[inLocale(locale, 'label')] = tooLong(LABEL_MAX_LENGTH)
    }
    if (length(values[inLocale(locale, 'unit')] ?? '') > UNIT_MAX_LENGTH) {
      errors[inLocale(locale, 'unit')] = tooLong(UNIT_MAX_LENGTH)
    }
  }
  // Libellés traduits des valeurs, par code de valeur (`choice.<valeur>`)
  const translations =
    fields === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(fields).map(([locale, texts]) => [
            locale,
            {
              ...texts,
              ...Object.fromEntries(
                rows.flatMap(({ choice, labels }) =>
                  choice.value === ''
                    ? []
                    : labels
                        .filter(([labelLocale]) => labelLocale === locale)
                        .map(([, translated]) => [`${CHOICE_LABEL}${choice.value}`, translated]),
                ),
              ),
            },
          ]),
        )

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
          ...(translations === undefined ? {} : { translations }),
        }
      : null

  return { values, errors, data }
}
