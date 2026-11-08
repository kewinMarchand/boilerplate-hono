import { html } from 'hono/html'

import { selectField, textField } from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'

import { ATTRIBUTE_TYPES } from '#/catalog/domain/catalog.ts'

import { choiceKey, choiceRowCount } from './adminAttributeForms.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Errors, Values } from '#/shared/http/adminForms.ts'

const TYPE_LABELS: Record<Catalog.AttributeType, string> = {
  choice: 'Liste de valeurs',
  number: 'Nombre',
  text: 'Texte',
}

export const attributesPage = (
  attributes: readonly Catalog.ProductAttribute[],
  message?: string,
  error?: string,
) =>
  adminPage(
    'Attributs',
    '/admin/attributs',
    html`<h1>Attributs</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/attributs/nouveau">Nouvel attribut</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">Libellé</th>
            <th scope="col">Code</th>
            <th scope="col">Type</th>
            <th scope="col">Unité</th>
            <th scope="col">Valeurs</th>
            <th scope="col">Filtre du catalogue</th>
            <th scope="col">Position</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${attributes.map(
            (attribute) =>
              html`<tr>
                <td>${attribute.label}</td>
                <td><code>${attribute.code}</code></td>
                <td>${TYPE_LABELS[attribute.type]}</td>
                <td>${attribute.unit ?? '—'}</td>
                <td>${attribute.choices.map(({ label }) => label).join(', ') || '—'}</td>
                <td>${attribute.filterable ? 'Oui' : 'Non'}</td>
                <td>${attribute.position}</td>
                <td>
                  <a href="/admin/attributs/${attribute.code}/modifier"
                    >Modifier<span class="sr"> ${attribute.label}</span></a
                  >
                  ·
                  <a href="/admin/attributs/${attribute.code}/supprimer"
                    >Supprimer<span class="sr"> ${attribute.label}</span></a
                  >
                </td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

const codeField = (values: Values, errors: Errors, locked: boolean) => {
  const error = errors.code
  const describedBy = error === undefined ? 'aide-code' : 'aide-code erreur-code'

  return html`<label for="code">Code</label>
    <input
      id="code"
      name="code"
      type="text"
      value="${values.code ?? ''}"
      aria-describedby="${describedBy}"
      ${locked ? 'disabled' : ''}
      ${error === undefined ? '' : html`aria-invalid="true"`}
    />
    <p id="aide-code">
      Minuscules, chiffres et tirets, commence par une lettre : il apparaît dans les filtres du
      catalogue. Il ne change plus après la création.
    </p>
    ${error === undefined ? '' : html`<p class="erreur-champ" id="erreur-code">${error}</p>`}`
}

/** Une ligne de valeur par paire de champs ; une ligne laissée vide est ignorée. */
const choiceRows = (values: Values, errors: Errors) =>
  Array.from({ length: choiceRowCount(values) }, (_, index) => {
    const value = choiceKey(index, 'value')
    const label = choiceKey(index, 'label')
    const number = index + 1

    return html`<fieldset>
      <legend>Valeur ${number}</legend>
      ${textField(`Code de la valeur ${number}`, value, values, errors)}
      ${textField(`Libellé de la valeur ${number}`, label, values, errors)}
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
        ${codeField(values, errors, locked)} ${textField('Libellé', 'label', values, errors)}
        ${selectField(
          'Type',
          'type',
          ATTRIBUTE_TYPES.map((type) => [type, TYPE_LABELS[type]] as const),
          values,
          errors,
        )}
        ${textField('Unité (facultative : « mm », « km », « cm »)', 'unit', values, errors)}
        <label for="filterable">
          <input
            id="filterable"
            name="filterable"
            type="checkbox"
            aria-describedby="aide-filterable"
            ${values.filterable === 'on' ? 'checked' : ''}
          />Filtre du catalogue
        </label>
        <p id="aide-filterable">Liste de valeurs seulement : une facette du catalogue.</p>
        ${textField('Position', 'position', values, errors, 'number')}
        <h2>Valeurs</h2>
        <p>
          Liste de valeurs seulement, dans l'ordre d'affichage. Vider une ligne retire la valeur ;
          enregistrer ajoute de nouvelles lignes vides.
        </p>
        ${choiceRows(values, errors)}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="/admin/attributs">Retour aux attributs</a></p>`,
  )
