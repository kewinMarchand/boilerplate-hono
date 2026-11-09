import { html } from 'hono/html'

import { t } from './adminI18n.ts'

/**
 * Formulaires de l'admin, communs aux modules : lecture des champs envoyés, contrôle de forme à la
 * frontière (champs obligatoires, longueurs, slug, entiers) avec les messages de Symfony des
 * formulaires de l'API Platform, et champs HTML accessibles (libellé, erreur reliée au champ).
 * Les règles métier (unicité, existence…) sont vérifiées ensuite par les cas d'usage de chaque module.
 */
export type Values = Record<string, string>
export type Errors = Record<string, string>

export interface FormResult<T> {
  readonly values: Values
  readonly errors: Errors
  readonly data: T | null
}

const MAX_LENGTH = 255

/** Slugs saisis : minuscules, chiffres et tirets, comme CategoryType::SLUG_PATTERN de l'API Platform. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const field = (body: Record<string, unknown>, name: string): string => {
  const value = body[name]
  return typeof value === 'string' ? value.trim() : ''
}

export const requiredText = (errors: Errors, name: string, value: string): void => {
  if (value === '') {
    errors[name] = t('validator.not_blank')
  } else if (Array.from(value).length > MAX_LENGTH) {
    errors[name] = t('validator.too_long', { max: MAX_LENGTH })
  }
}

export const slugField = (errors: Errors, value: string): void => {
  requiredText(errors, 'slug', value)
  if (errors.slug === undefined && !SLUG_PATTERN.test(value)) {
    errors.slug = t('constraint.slug')
  }
}

/** Format HTML5 de la contrainte Email de Symfony (mode html5), celui du formulaire de contact. */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+\\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/** Adresse mail obligatoire, messages des contraintes NotBlank, Length et Email de Symfony. */
export const requiredEmail = (errors: Errors, name: string, value: string): void => {
  requiredText(errors, name, value)
  if (errors[name] === undefined && !EMAIL_PATTERN.test(value)) {
    errors[name] = t('validator.email')
  }
}

export const integer = (value: string): number | null =>
  /^-?\d+$/.test(value) ? Number(value) : null

const fieldError = (errors: Errors, name: string) =>
  errors[name] === undefined
    ? ''
    : html`<p class="erreur-champ" id="erreur-${name}">${errors[name]}</p>`

const described = (errors: Errors, name: string) =>
  errors[name] === undefined ? '' : html`aria-invalid="true" aria-describedby="erreur-${name}"`

export const textField = (
  label: string,
  name: string,
  values: Values,
  errors: Errors,
  type = 'text',
) =>
  html`<label for="${name}">${label}</label>
    <input
      id="${name}"
      name="${name}"
      type="${type}"
      value="${values[name] ?? ''}"
      ${described(errors, name)}
    />
    ${fieldError(errors, name)}`

export const textareaField = (
  label: string,
  name: string,
  values: Values,
  errors: Errors,
  rows = 4,
) =>
  html`<label for="${name}">${label}</label>
    <textarea id="${name}" name="${name}" rows="${rows}" ${described(errors, name)}>
${values[name] ?? ''}</textarea>
    ${fieldError(errors, name)}`

export const selectField = (
  label: string,
  name: string,
  options: readonly (readonly [string, string])[],
  values: Values,
  errors: Errors,
) =>
  html`<label for="${name}">${label}</label>
    <select id="${name}" name="${name}" ${described(errors, name)}>
      ${options.map(
        ([value, text]) =>
          html`<option value="${value}" ${values[name] === value ? 'selected' : ''}>
            ${text}
          </option>`,
      )}
    </select>
    ${fieldError(errors, name)}`

export const maxLength = (errors: Errors, name: string, value: string, max: number): void => {
  if (Array.from(value).length > max) {
    errors[name] = t('validator.too_long', { max })
  }
}

/** Case à cocher envoyée : « on » cochée, vide sinon. */
export const checkbox = (body: Record<string, unknown>, name: string): string =>
  field(body, name) === '' ? '' : 'on'

/** Case à cocher et son aide éventuelle, reliée par aria-describedby. */
export const checkboxField = (label: string, name: string, values: Values, help?: string) =>
  html`<label for="${name}">
      <input
        id="${name}"
        name="${name}"
        type="checkbox"
        ${help === undefined ? '' : html`aria-describedby="aide-${name}"`}
        ${values[name] === 'on' ? 'checked' : ''}
      />${label}
    </label>
    ${help === undefined ? '' : html`<p id="aide-${name}">${help}</p>`}`

/** Titre et description du référencement (SPEC-COMMUNE, section 26), comme MetaFields de l'API Platform. */
export const META_TITLE_MAX_LENGTH = 60
export const META_DESCRIPTION_MAX_LENGTH = 160

export interface MetaFields {
  readonly title: string
  readonly description: string
}

/** Lit et contrôle les deux champs du référencement, facultatifs : vides, le front garde les siens. */
export const readMetaFields = (
  body: Record<string, unknown>,
  values: Values,
  errors: Errors,
  titleName = 'metaTitle',
  descriptionName = 'metaDescription',
): MetaFields => {
  const title = field(body, titleName)
  const description = field(body, descriptionName)
  values[titleName] = title
  values[descriptionName] = description
  maxLength(errors, titleName, title, META_TITLE_MAX_LENGTH)
  maxLength(errors, descriptionName, description, META_DESCRIPTION_MAX_LENGTH)
  return { title, description }
}

export const metaFieldsHtml = (
  values: Values,
  errors: Errors,
  titleName = 'metaTitle',
  descriptionName = 'metaDescription',
) =>
  html`${textField(t('field.meta_title'), titleName, values, errors)}
    <p>${t('help.meta_title', { max: META_TITLE_MAX_LENGTH })}</p>
    ${textareaField(t('field.meta_description'), descriptionName, values, errors, 3)}
    <p>${t('help.meta_description', { max: META_DESCRIPTION_MAX_LENGTH })}</p>`
