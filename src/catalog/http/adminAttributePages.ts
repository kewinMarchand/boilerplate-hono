import { html } from 'hono/html'

import { selectField, textField } from '#/shared/http/adminForms.ts'
import { t } from '#/shared/http/adminI18n.ts'
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'
import { inLocale, labelIn, languageTabs, otherLocales } from '#/shared/http/adminTranslations.ts'

import { ATTRIBUTE_TYPES } from '#/catalog/domain/catalog.ts'

import {
  ATTRIBUTE_TRANSLATED,
  choiceKey,
  choiceRowCount,
  choiceTranslationKey,
} from './adminAttributeForms.ts'
import { rowActions } from './adminCatalogPages.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Errors, Values } from '#/shared/http/adminForms.ts'

const typeLabel = (type: Catalog.AttributeType): string => t(`attribute_type.${type}`)

export const attributesPage = (
  attributes: readonly Catalog.ProductAttribute[],
  message?: string,
  error?: string,
) =>
  adminPage(
    t('entity.attributes'),
    '/admin/attributs',
    html`<h1>${t('entity.attributes')}</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/attributs/nouveau">${t('title.new_attribute')}</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">${t('field.label')}</th>
            <th scope="col">${t('field.code')}</th>
            <th scope="col">${t('field.type')}</th>
            <th scope="col">${t('field.unit')}</th>
            <th scope="col">${t('field.choices')}</th>
            <th scope="col">${t('field.filterable')}</th>
            <th scope="col">${t('field.position')}</th>
            <th scope="col">${t('field.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${attributes.map(
            (attribute) =>
              html`<tr>
                <td>${attribute.label}</td>
                <td><code>${attribute.code}</code></td>
                <td>${typeLabel(attribute.type)}</td>
                <td>${attribute.unit ?? '—'}</td>
                <td>${attribute.choices.map(({ label }) => label).join(', ') || '—'}</td>
                <td>${attribute.filterable ? t('common.yes') : t('common.no')}</td>
                <td>${attribute.position}</td>
                <td>${rowActions(`/admin/attributs/${attribute.code}`, attribute.label)}</td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

const codeField = (values: Values, errors: Errors, locked: boolean) => {
  const error = errors.code
  const describedBy = error === undefined ? 'aide-code' : 'aide-code erreur-code'

  return html`<label for="code">${t('field.code')}</label>
    <input
      id="code"
      name="code"
      type="text"
      value="${values.code ?? ''}"
      aria-describedby="${describedBy}"
      ${locked ? 'disabled' : ''}
      ${error === undefined ? '' : html`aria-invalid="true"`}
    />
    <p id="aide-code">${t('help.attribute_code')}</p>
    ${error === undefined ? '' : html`<p class="erreur-champ" id="erreur-code">${error}</p>`}`
}

/** Une ligne de valeur par paire de champs ; une ligne laissée vide est ignorée. */
const choiceRows = (values: Values, errors: Errors) =>
  Array.from({ length: choiceRowCount(values) }, (_, index) => {
    const value = choiceKey(index, 'value')
    const label = choiceKey(index, 'label')
    const number = index + 1

    return html`<fieldset>
      <legend>${t('choice.legend', { number })}</legend>
      ${textField(t('choice.code', { number }), value, values, errors)}
      ${textField(t('choice.label', { number }), label, values, errors)}
      ${otherLocales().map((locale) =>
        textField(
          labelIn(t('choice.label', { number }), locale),
          choiceTranslationKey(index, locale),
          values,
          errors,
        ),
      )}
    </fieldset>`
  })

export const attributeFormPage = (
  title: string,
  action: string,
  values: Values,
  errors: Errors = {},
  error?: string,
  locked = false,
) =>
  adminPage(
    title,
    '/admin/attributs',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" novalidate>
        ${codeField(values, errors, locked)}
        ${languageTabs(
          'attribut',
          ATTRIBUTE_TRANSLATED,
          errors,
          (locale) =>
            html`${textField(t('field.label'), inLocale(locale, 'label'), values, errors)}
              ${textField(t('field.unit'), inLocale(locale, 'unit'), values, errors)}
              <p>${t('help.unit')}</p>`,
        )}
        ${selectField(
          t('field.type'),
          'type',
          ATTRIBUTE_TYPES.map((type) => [type, typeLabel(type)] as const),
          values,
          errors,
        )}
        <label for="filterable">
          <input
            id="filterable"
            name="filterable"
            type="checkbox"
            aria-describedby="aide-filterable"
            ${values.filterable === 'on' ? 'checked' : ''}
          />${t('field.filterable')}
        </label>
        <p id="aide-filterable">${t('help.filterable')}</p>
        ${textField(t('field.position'), 'position', values, errors, 'number')}
        <h2>${t('field.choices')}</h2>
        <p>${t('help.choices')}</p>
        ${choiceRows(values, errors)}
        <button type="submit">${t('form.save')}</button>
      </form>
      <p><a href="/admin/attributs">${t('attribute.back')}</a></p>`,
  )
