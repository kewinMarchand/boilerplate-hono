import { Hono } from 'hono'
import { html } from 'hono/html'

import {
  checkbox,
  checkboxField,
  field,
  maxLength,
  requiredEmail,
  selectField,
  textField,
} from '#/shared/http/adminForms.ts'
import { refusalMessage, t } from '#/shared/http/adminI18n.ts'
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'
import {
  CONTENT_LANGUAGES,
  inLocale,
  languageTabs,
  otherLocales,
  readTranslations,
  translationValues,
} from '#/shared/http/adminTranslations.ts'

import { COLOR_SCHEMES } from '#/site/domain/SiteIdentity.ts'
import { getSiteIdentity, updateSiteIdentity } from '#/site/application/siteIdentity.ts'
import {
  fileContent,
  imageFieldsHtml,
  imageFileHtml,
  imagePreviewScript,
  readImageFields,
} from '#/media/http/adminImageFields.ts'

import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'
import type { SiteDependencies } from '#/site/application/siteIdentity.ts'
import type { SiteIdentity } from '#/site/domain/SiteIdentity.ts'

/**
 * Admin de l'identité du site (ADR 0005) : une seule fiche, en modification seule, derrière la
 * session de l'admin. La page (GET et POST) est son formulaire, rempli par getSiteIdentity (les
 * valeurs du modèle tant que rien n'est enregistré). La forme est vérifiée ici, les couleurs et les
 * images (logo, icône, image de partage) par le cas d'usage, avec les messages de SiteIdentityType
 * et SiteIdentityCrudController. Couleurs en sélecteur natif (`<input type="color">`) derrière la
 * case « Utiliser les couleurs de la bibliothèque », qui remplace le champ vide qu'un sélecteur de
 * couleur ne sait pas exprimer.
 */
const PATH = '/admin/identite-du-site'

/** Nom et accroche se traduisent (ADR 0014). */
const IDENTITY_TRANSLATED = ['name', 'tagline'] as const

/** Langues du contenu proposées : codes de la liste fixe, chacune écrite dans sa langue. */
const LANGUAGE_CODES = Object.keys(CONTENT_LANGUAGES)

/** Case d'une autre langue du contenu : `otherLocales[en]`. */
const otherLocaleField = (locale: string): string => `otherLocales[${locale}]`

const isColorScheme = (value: string): value is SiteIdentity.ColorScheme =>
  COLOR_SCHEMES.some((scheme) => scheme === value)

/** Valeur d'un sélecteur de couleur sans couleur enregistrée : le noir, comme le navigateur. */
const NO_COLOR = '#000000'

export const readSiteIdentityForm = async (
  body: Record<string, unknown>,
): Promise<FormResult<SiteIdentity.Input>> => {
  const name = field(body, 'name')
  const tagline = field(body, 'tagline')
  const primaryColor = field(body, 'primaryColor')
  const secondaryColor = field(body, 'secondaryColor')
  const defaultColorScheme = field(body, 'defaultColorScheme')
  const contactRecipient = field(body, 'contactRecipient')
  const values: Values = {
    name,
    tagline,
    useLibraryColors: checkbox(body, 'useLibraryColors'),
    primaryColor,
    secondaryColor,
    defaultColorScheme,
    removeLogo: checkbox(body, 'removeLogo'),
    removeIcon: checkbox(body, 'removeIcon'),
    removeShareImage: checkbox(body, 'removeShareImage'),
    salesEnabled: checkbox(body, 'salesEnabled'),
    contactRecipient,
  }
  const defaultLocale = field(body, 'defaultLocale')
  values.defaultLocale = defaultLocale
  const others = LANGUAGE_CODES.filter((locale) => {
    const checked = checkbox(body, otherLocaleField(locale))
    values[otherLocaleField(locale)] = checked
    return checked === 'on' && locale !== defaultLocale
  })
  const errors: Errors = {}
  if (name === '') {
    errors.name = t('validator.not_blank')
  }
  maxLength(errors, 'name', name, 60)
  maxLength(errors, 'tagline', tagline, 160)
  if (!isColorScheme(defaultColorScheme)) {
    errors.defaultColorScheme = t('validator.choice')
  }
  if (!LANGUAGE_CODES.includes(defaultLocale)) {
    errors.defaultLocale = t('validator.choice')
  }
  const translations = readTranslations(body, IDENTITY_TRANSLATED, values, errors)
  for (const locale of otherLocales()) {
    maxLength(errors, inLocale(locale, 'name'), values[inLocale(locale, 'name')] ?? '', 60)
    maxLength(errors, inLocale(locale, 'tagline'), values[inLocale(locale, 'tagline')] ?? '', 160)
  }
  requiredEmail(errors, 'contactRecipient', contactRecipient)
  const image = await readImageFields(body, values, errors)
  const shareImage = await readImageFields(body, values, errors, 'shareImage')
  const iconContent = await fileContent(body, 'iconContent')

  return {
    values,
    errors,
    data:
      Object.keys(errors).length === 0 && isColorScheme(defaultColorScheme)
        ? {
            name,
            tagline,
            useLibraryColors: values.useLibraryColors === 'on',
            primaryColor,
            secondaryColor,
            defaultColorScheme,
            imageContent: image.content,
            imageAlt: image.alt,
            removeLogo: values.removeLogo === 'on',
            shareImageContent: shareImage.content,
            shareImageAlt: shareImage.alt,
            removeShareImage: values.removeShareImage === 'on',
            iconContent,
            removeIcon: values.removeIcon === 'on',
            salesEnabled: values.salesEnabled === 'on',
            contactRecipient,
            defaultLocale,
            otherLocales: others,
            ...(translations === undefined ? {} : { translations }),
          }
        : null,
  }
}

const valuesOf = ({
  name,
  tagline,
  logo,
  colors,
  defaultColorScheme,
  shareImage,
  salesEnabled,
  contactRecipient,
  locales: [defaultLocale, ...others],
  translations,
}: SiteIdentity.Entity): Values => ({
  name,
  tagline,
  useLibraryColors: colors === null ? 'on' : '',
  primaryColor: colors?.primary ?? NO_COLOR,
  secondaryColor: colors?.secondary ?? NO_COLOR,
  defaultColorScheme,
  imageAlt: logo?.alt ?? '',
  removeLogo: '',
  shareImageAlt: shareImage?.alt ?? '',
  removeShareImage: '',
  removeIcon: '',
  salesEnabled: salesEnabled ? 'on' : '',
  contactRecipient,
  defaultLocale,
  ...Object.fromEntries(
    LANGUAGE_CODES.map((locale) => [otherLocaleField(locale), others.includes(locale) ? 'on' : '']),
  ),
  ...translationValues(translations, IDENTITY_TRANSLATED),
})

/** Langue par défaut et autres langues du contenu (ADR 0014), chacune écrite dans sa langue. */
const localeFields = (values: Values, errors: Errors) =>
  html`${selectField(
      t('field.default_locale'),
      'defaultLocale',
      Object.entries(CONTENT_LANGUAGES),
      values,
      errors,
    )}
    <p>${t('help.default_locale')}</p>
    <fieldset aria-describedby="aide-otherLocales">
      <legend>${t('field.other_locales')}</legend>
      ${Object.entries(CONTENT_LANGUAGES).map(
        ([locale, name]) =>
          html`<label for="${otherLocaleField(locale)}">
            <input
              id="${otherLocaleField(locale)}"
              name="${otherLocaleField(locale)}"
              type="checkbox"
              ${values[otherLocaleField(locale)] === 'on' ? 'checked' : ''}
            /><span lang="${locale}">${name}</span>
          </label>`,
      )}
      <p id="aide-otherLocales">${t('help.other_locales')}</p>
    </fieldset>`

const formPage = (
  values: Values,
  identity: SiteIdentity.Entity,
  {
    errors = {},
    error,
    message,
  }: { errors?: Errors; error?: string; message?: string | undefined } = {},
) =>
  adminPage(
    t('entity.site_identity'),
    PATH,
    html`<h1>${t('entity.site_identity')}</h1>
      ${flash(message)} ${formError(error)}
      <form method="post" action="${PATH}" enctype="multipart/form-data" novalidate>
        ${languageTabs(
          'identite',
          IDENTITY_TRANSLATED,
          errors,
          (locale) =>
            html`${textField(t('field.site_name'), inLocale(locale, 'name'), values, errors)}
              ${textField(t('field.tagline'), inLocale(locale, 'tagline'), values, errors)}
              <p>${t('help.tagline')}</p>`,
        )}
        ${localeFields(values, errors)}
        ${imageFieldsHtml('logo', t('help.site_alt'), values, errors, identity.logo, {
          label: t('field.logo'),
          decorative: false,
          previewLabel: t('image.current_logo'),
        })}
        ${checkboxField(t('field.remove_logo'), 'removeLogo', values, t('help.remove_logo'))}
        ${imageFileHtml(
          'icon',
          'iconContent',
          t('field.icon'),
          identity.icon,
          t('image.current_icon'),
        )}
        ${checkboxField(t('field.remove_icon'), 'removeIcon', values, t('help.remove_icon'))}
        ${imageFieldsHtml('share', t('help.site_alt'), values, errors, identity.shareImage, {
          label: t('field.share_image'),
          decorative: false,
          prefix: 'shareImage',
          previewLabel: t('image.current_share'),
        })}
        ${checkboxField(
          t('field.remove_share_image'),
          'removeShareImage',
          values,
          t('help.remove_share_image'),
        )}
        ${checkboxField(
          t('field.library_colors'),
          'useLibraryColors',
          values,
          t('help.library_colors'),
        )}
        ${textField(t('field.primary_color'), 'primaryColor', values, errors, 'color')}
        <p>${t('help.primary_color')}</p>
        ${textField(t('field.secondary_color'), 'secondaryColor', values, errors, 'color')}
        <p>${t('help.secondary_color')}</p>
        ${selectField(
          t('field.color_scheme'),
          'defaultColorScheme',
          COLOR_SCHEMES.map((scheme) => [scheme, t(`color_scheme.${scheme}`)] as const),
          values,
          errors,
        )}
        <p>${t('help.color_scheme')}</p>
        ${checkboxField(t('field.sales'), 'salesEnabled', values, t('help.sales'))}
        ${textField(t('field.contact_recipient'), 'contactRecipient', values, errors, 'email')}
        <p>${t('help.contact_recipient')}</p>
        <button type="submit">${t('form.save')}</button>
      </form>
      ${imagePreviewScript}`,
  )

const refusal = refusalMessage

export const adminSiteRoutes = (dependencies: SiteDependencies) => {
  const app = new Hono()

  app.get(PATH, async (c) => {
    const identity = await getSiteIdentity(dependencies)
    const message = c.req.query('ok') === 'modifie' ? t('flash.site_identity_saved') : undefined
    return c.html(formPage(valuesOf(identity), identity, { message }))
  })

  app.post(PATH, async (c) => {
    const form = await readSiteIdentityForm(await c.req.parseBody())
    const current = () => getSiteIdentity(dependencies)
    if (form.data === null) {
      return c.html(formPage(form.values, await current(), { errors: form.errors }), 422)
    }
    try {
      await updateSiteIdentity(dependencies, form.data)
    } catch (error) {
      return c.html(formPage(form.values, await current(), { error: refusal(error) }), 422)
    }
    return c.redirect(`${PATH}?ok=modifie`, 303)
  })

  return app
}
