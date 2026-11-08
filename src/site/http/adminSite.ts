import { Hono } from 'hono'
import { html } from 'hono/html'

import { field, selectField, textField } from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'

import { MediaRuleViolation } from '#/media/domain/imageRules.ts'
import { COLOR_SCHEMES, SiteRuleViolation } from '#/site/domain/SiteIdentity.ts'
import { getSiteIdentity, updateSiteIdentity } from '#/site/application/siteIdentity.ts'
import { imageFieldsHtml, readImageFields } from '#/media/http/adminImageFields.ts'

import type { Media } from '#/media/domain/Media.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'
import type { SiteDependencies } from '#/site/application/siteIdentity.ts'
import type { SiteIdentity } from '#/site/domain/SiteIdentity.ts'

/**
 * Admin de l'identité du site (ADR 0005) : une seule fiche, en modification seule, derrière la
 * session de l'admin. La page (GET et POST) est son formulaire, rempli par getSiteIdentity (les
 * valeurs du modèle tant que rien n'est enregistré). La forme est vérifiée ici, les couleurs et le
 * logo par le cas d'usage, avec les messages de SiteIdentityType et SiteIdentityCrudController.
 */
const PATH = '/admin/identite-du-site'
const TITLE = 'Identité du site'

const SCHEME_LABELS: Record<SiteIdentity.ColorScheme, string> = {
  auto: 'Celui du système du visiteur',
  light: 'Clair',
  dark: 'Sombre',
}

const isColorScheme = (value: string): value is SiteIdentity.ColorScheme =>
  COLOR_SCHEMES.some((scheme) => scheme === value)

const maxLength = (errors: Errors, name: string, value: string, max: number): void => {
  if (Array.from(value).length > max) {
    errors[name] = `Cette chaîne est trop longue. Elle doit avoir au maximum ${max} caractères.`
  }
}

export const readSiteIdentityForm = async (
  body: Record<string, unknown>,
): Promise<FormResult<SiteIdentity.Input>> => {
  const name = field(body, 'name')
  const tagline = field(body, 'tagline')
  const primaryColor = field(body, 'primaryColor')
  const secondaryColor = field(body, 'secondaryColor')
  const defaultColorScheme = field(body, 'defaultColorScheme')
  const removeLogo = field(body, 'removeLogo') !== ''
  const values: Values = {
    name,
    tagline,
    primaryColor,
    secondaryColor,
    defaultColorScheme,
    removeLogo: removeLogo ? 'on' : '',
  }
  const errors: Errors = {}
  if (name === '') {
    errors.name = 'Cette valeur ne doit pas être vide.'
  }
  maxLength(errors, 'name', name, 60)
  maxLength(errors, 'tagline', tagline, 160)
  if (!isColorScheme(defaultColorScheme)) {
    errors.defaultColorScheme = 'Le choix sélectionné est invalide.'
  }
  const image = await readImageFields(body, values, errors)

  return {
    values,
    errors,
    data:
      Object.keys(errors).length === 0 && isColorScheme(defaultColorScheme)
        ? {
            name,
            tagline,
            primaryColor,
            secondaryColor,
            defaultColorScheme,
            imageContent: image.content,
            imageAlt: image.alt,
            removeLogo,
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
}: SiteIdentity.Entity): Values => ({
  name,
  tagline,
  primaryColor: colors?.primary ?? '',
  secondaryColor: colors?.secondary ?? '',
  defaultColorScheme,
  imageAlt: logo?.alt ?? '',
  removeLogo: '',
})

const formPage = (
  values: Values,
  logo: Media.Image | null,
  {
    errors = {},
    error,
    message,
  }: { errors?: Errors; error?: string; message?: string | undefined } = {},
) =>
  adminPage(
    TITLE,
    PATH,
    html`<h1>${TITLE}</h1>
      ${flash(message)} ${formError(error)}
      <form method="post" action="${PATH}" enctype="multipart/form-data" novalidate>
        ${textField('Nom du site', 'name', values, errors)}
        ${textField('Accroche', 'tagline', values, errors)}
        <p>Texte du hero de l'accueil et description par défaut des pages.</p>
        ${imageFieldsHtml('logo', 'Vide : le nom du site.', values, errors, logo, {
          label: 'Logo',
          decorative: false,
        })}
        <label for="removeLogo">
          <input
            id="removeLogo"
            name="removeLogo"
            type="checkbox"
            ${values.removeLogo === 'on' ? 'checked' : ''}
          />Retirer le logo
        </label>
        <p>
          Le header affiche alors le pictogramme et le nom du site. Un fichier envoyé en même temps
          est ignoré.
        </p>
        ${textField('Couleur principale', 'primaryColor', values, errors)}
        <p>
          Couleur des liens et des boutons, au format #rrggbb : elle doit contraster à 4,5:1 au
          moins avec le fond blanc. Les deux couleurs vides : celles de la bibliothèque. Le thème
          sombre et les déclinaisons sont calculés.
        </p>
        ${textField('Couleur secondaire', 'secondaryColor', values, errors)}
        <p>Elle doit porter un texte lisible (blanc ou quasi-noir à 4,5:1 au moins).</p>
        ${selectField(
          'Thème par défaut',
          'defaultColorScheme',
          COLOR_SCHEMES.map((scheme) => [scheme, SCHEME_LABELS[scheme]] as const),
          values,
          errors,
        )}
        <p>Thème servi tant que le visiteur n'a rien choisi.</p>
        <button type="submit">Enregistrer</button>
      </form>`,
  )

const refusal = (error: unknown): string => {
  if (error instanceof SiteRuleViolation || error instanceof MediaRuleViolation) {
    return error.message
  }
  throw error
}

export const adminSiteRoutes = (dependencies: SiteDependencies) => {
  const app = new Hono()

  app.get(PATH, async (c) => {
    const identity = await getSiteIdentity(dependencies)
    const message = c.req.query('ok') === 'modifie' ? 'Identité du site enregistrée.' : undefined
    return c.html(formPage(valuesOf(identity), identity.logo, { message }))
  })

  app.post(PATH, async (c) => {
    const form = await readSiteIdentityForm(await c.req.parseBody())
    const logo = async () => (await getSiteIdentity(dependencies)).logo
    if (form.data === null) {
      return c.html(formPage(form.values, await logo(), { errors: form.errors }), 422)
    }
    try {
      await updateSiteIdentity(dependencies, form.data)
    } catch (error) {
      return c.html(formPage(form.values, await logo(), { error: refusal(error) }), 422)
    }
    return c.redirect(`${PATH}?ok=modifie`, 303)
  })

  return app
}
