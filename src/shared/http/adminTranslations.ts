import { AsyncLocalStorage } from 'node:async_hooks'
import { createMiddleware } from 'hono/factory'
import { html } from 'hono/html'

import { field, SLUG_PATTERN } from './adminForms.ts'
import { t } from './adminI18n.ts'

import type { Errors, Values } from './adminForms.ts'
import type { Html } from './adminLayout.ts'
import type { Translations, TranslationsInput } from '#/shared/domain/translations.ts'

/**
 * Saisie des textes traduisibles dans l'admin (SPEC-COMMUNE, section 29, ADR 0014) : un onglet par
 * langue du contenu, la langue par défaut en premier (seule à champs obligatoires). Un site d'une
 * seule langue n'a ni onglet ni champ de traduction : le formulaire est celui d'avant.
 */

/** Langues que l'admin propose pour le contenu, chacune écrite dans sa langue, comme ContentLanguages de l'API Platform. */
export const CONTENT_LANGUAGES: Readonly<Record<string, string>> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  nl: 'Nederlands',
  pt: 'Português',
}

export const languageName = (locale: string): string => CONTENT_LANGUAGES[locale] ?? locale

const storage = new AsyncLocalStorage<readonly [string, ...string[]]>()

/** Langues du contenu, lues une fois par requête de l'admin. */
export const adminContentLocales = (load: () => Promise<readonly [string, ...string[]]>) =>
  createMiddleware(async (_c, next) => {
    await storage.run(await load(), next)
  })

/** Langues du contenu de la requête en cours, la langue par défaut en premier. */
export const contentLocales = (): readonly [string, ...string[]] => storage.getStore() ?? ['fr']

/** Langues traduites : toutes sauf la langue par défaut ; aucune sur un site monolingue. */
export const otherLocales = (): readonly string[] => contentLocales().slice(1)

/** Nom d'un champ dans une langue : le champ lui-même pour la langue par défaut (null). */
export const inLocale = (locale: string | null, name: string): string =>
  locale === null ? name : `translations[${locale}][${name}]`

/**
 * Traductions saisies pour `fields`, une entrée par langue traduite (même vide : l'unicité des slugs
 * la vérifie), recopiées dans `values` ; undefined sur un site monolingue (traductions gardées).
 */
export const readTranslations = (
  body: Record<string, unknown>,
  fields: readonly string[],
  values: Values,
  errors: Errors,
): TranslationsInput | undefined => {
  const locales = otherLocales()
  if (locales.length === 0) {
    return undefined
  }
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      Object.fromEntries(
        fields.map((name) => {
          const key = inLocale(locale, name)
          const value = field(body, key)
          values[key] = value
          if (name === 'slug' && value !== '' && !SLUG_PATTERN.test(value)) {
            errors[key] = t('constraint.slug')
          }
          return [name, value]
        }),
      ),
    ]),
  )
}

/** Valeurs du formulaire des traductions enregistrées, pour les langues traduites. */
export const translationValues = (translations: Translations, fields: readonly string[]): Values =>
  Object.fromEntries(
    otherLocales().flatMap((locale) =>
      fields.map((name) => [inLocale(locale, name), translations[locale]?.[name] ?? '']),
    ),
  )

const hasErrors = (errors: Errors, names: readonly string[]): boolean =>
  names.some((name) => errors[name] !== undefined)

/**
 * Onglets de langue autour des champs traduisibles `fields` : `render(null)` rend les champs de la
 * langue par défaut, `render(langue)` ceux d'une traduction. Boutons radio et CSS, sans script (la
 * CSP de l'admin n'en autorise qu'un) ; un onglet qui contient une erreur est marqué et ouvert.
 */
export const languageTabs = (
  group: string,
  fields: readonly string[],
  errors: Errors,
  render: (locale: string | null) => Html,
) => {
  const [defaultLocale, ...others] = contentLocales()
  if (others.length === 0) {
    return render(null)
  }
  const tabs = [null, ...others].map((locale) => {
    const code = locale ?? defaultLocale
    return {
      locale,
      id: `onglet-${group}-${code}`,
      panel: `panneau-${group}-${code}`,
      name: languageName(code),
      invalid: hasErrors(
        errors,
        fields.map((name) => inLocale(locale, name)),
      ),
    }
  })
  const opened = tabs.find((tab) => tab.invalid) ?? tabs[0]

  return html`<div class="onglets">
    <style>
      ${tabs.map(({ id, panel }) => `.onglets:has(#${id}:checked) #${panel} { display: block; }`)}
    </style>
    <fieldset class="choix">
      <legend>${t('tabs.legend')}</legend>
      ${tabs.map(
        (tab) =>
          html`<input
              type="radio"
              name="_onglet-${group}"
              id="${tab.id}"
              ${tab === opened ? 'checked' : ''}
            /><label for="${tab.id}">${tab.name}${tab.invalid ? t('tabs.has_errors') : ''}</label>`,
      )}
    </fieldset>
    ${tabs.map(
      (tab) =>
        html`<div class="panneau" id="${tab.panel}">
          ${
            tab.locale === null
              ? ''
              : html`<p>${t('tabs.fallback', { language: languageName(defaultLocale) })}</p>`
          }
          ${render(tab.locale)}
        </div>`,
    )}
  </div>`
}

/** Libellé d'un champ traduit dans sa ligne (galerie, valeurs d'attribut) : « Libellé (English) ». */
export const labelIn = (label: string, locale: string): string =>
  `${label} (${languageName(locale)})`
