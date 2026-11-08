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
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'

import { MediaRuleViolation } from '#/media/domain/imageRules.ts'
import { COLOR_SCHEMES, SiteRuleViolation } from '#/site/domain/SiteIdentity.ts'
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
const TITLE = 'Identité du site'

const SCHEME_LABELS: Record<SiteIdentity.ColorScheme, string> = {
  auto: 'Celui du système du visiteur',
  light: 'Clair',
  dark: 'Sombre',
}

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
  const errors: Errors = {}
  if (name === '') {
    errors.name = 'Cette valeur ne doit pas être vide.'
  }
  maxLength(errors, 'name', name, 60)
  maxLength(errors, 'tagline', tagline, 160)
  if (!isColorScheme(defaultColorScheme)) {
    errors.defaultColorScheme = 'Le choix sélectionné est invalide.'
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
})

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
    TITLE,
    PATH,
    html`<h1>${TITLE}</h1>
      ${flash(message)} ${formError(error)}
      <form method="post" action="${PATH}" enctype="multipart/form-data" novalidate>
        ${textField('Nom du site', 'name', values, errors)}
        ${textField('Accroche', 'tagline', values, errors)}
        <p>Texte du hero de l'accueil et description par défaut des pages.</p>
        ${imageFieldsHtml('logo', 'Vide : le nom du site.', values, errors, identity.logo, {
          label: 'Logo',
          decorative: false,
          previewLabel: 'Logo actuel',
        })}
        ${checkboxField(
          'Retirer le logo',
          'removeLogo',
          values,
          'Le header affiche alors le pictogramme et le nom du site. Un fichier envoyé en même temps est ignoré.',
        )}
        ${imageFileHtml(
          'icon',
          'iconContent',
          'Icône du site (favicons)',
          identity.icon,
          'Icône actuelle (192 px)',
        )}
        ${checkboxField(
          "Retirer l'icône",
          'removeIcon',
          values,
          'Les fronts servent alors leurs propres favicons. Un fichier envoyé en même temps est ignoré.',
        )}
        ${imageFieldsHtml('share', 'Vide : le nom du site.', values, errors, identity.shareImage, {
          label: 'Image de partage',
          decorative: false,
          prefix: 'shareImage',
          previewLabel: 'Image de partage actuelle',
        })}
        ${checkboxField(
          "Retirer l'image de partage",
          'removeShareImage',
          values,
          'Les fronts servent alors leur propre image de partage. Un fichier envoyé en même temps est ignoré.',
        )}
        ${checkboxField(
          'Utiliser les couleurs de la bibliothèque',
          'useLibraryColors',
          values,
          'Cochée : pas de couleurs de marque, les fronts gardent les jetons de boilerplates-ui et les deux couleurs ci-dessous sont ignorées.',
        )}
        ${textField('Couleur principale', 'primaryColor', values, errors, 'color')}
        <p>
          Couleur des liens et des boutons : elle doit contraster à 4,5:1 au moins avec le fond
          blanc. Le thème sombre et les déclinaisons sont calculés.
        </p>
        ${textField('Couleur secondaire', 'secondaryColor', values, errors, 'color')}
        <p>Elle doit porter un texte lisible (blanc ou quasi-noir à 4,5:1 au moins).</p>
        ${selectField(
          'Thème par défaut',
          'defaultColorScheme',
          COLOR_SCHEMES.map((scheme) => [scheme, SCHEME_LABELS[scheme]] as const),
          values,
          errors,
        )}
        <p>Thème servi tant que le visiteur n'a rien choisi.</p>
        ${checkboxField(
          'Vente en ligne (prix, panier et commande)',
          'salesEnabled',
          values,
          "Décochée : les fronts n'affichent ni prix ni panier, chaque produit propose une demande de renseignement.",
        )}
        ${textField('Adresse qui reçoit les messages', 'contactRecipient', values, errors, 'email')}
        <p>Messages du formulaire de contact et demandes de renseignement. Jamais publiée.</p>
        <button type="submit">Enregistrer</button>
      </form>
      ${imagePreviewScript}`,
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
