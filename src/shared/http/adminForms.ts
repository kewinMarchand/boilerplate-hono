import { html } from 'hono/html'

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
    errors[name] = 'Cette valeur ne doit pas être vide.'
  } else if (Array.from(value).length > MAX_LENGTH) {
    errors[name] =
      `Cette chaîne est trop longue. Elle doit avoir au maximum ${MAX_LENGTH} caractères.`
  }
}

export const slugField = (errors: Errors, value: string): void => {
  requiredText(errors, 'slug', value)
  if (errors.slug === undefined && !SLUG_PATTERN.test(value)) {
    errors.slug = 'Minuscules, chiffres et tirets seulement.'
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
