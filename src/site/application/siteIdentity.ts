import { keptTranslations, switchDefaultLocale } from '#/shared/domain/translations.ts'

import { brandColorsFromInput } from '#/site/domain/brandColors.ts'
import { DEFAULT_SITE_IDENTITY, siteLocales } from '#/site/domain/SiteIdentity.ts'
import { changeImage } from '#/media/application/storeImage.ts'

import type { MediaDependencies } from '#/media/application/storeImage.ts'
import type { SiteIdentity } from '#/site/domain/SiteIdentity.ts'

export interface SiteDependencies {
  readonly siteIdentities: SiteIdentity.Repository
  readonly media: MediaDependencies
  /**
   * Nouvelle langue par défaut du contenu (ADR 0014) : chaque module fait passer les traductions de
   * `to` dans les champs de ses éléments. Composé par database.ts depuis les modules.
   */
  readonly switchContentLocale: (from: string, to: string) => Promise<void>
}

/** L'identité enregistrée, ou les valeurs du modèle sur une base où l'admin ne l'a jamais modifiée. */
export const getSiteIdentity = async ({
  siteIdentities,
}: Pick<SiteDependencies, 'siteIdentities'>): Promise<SiteIdentity.Entity> =>
  (await siteIdentities.find()) ?? DEFAULT_SITE_IDENTITY

const altOrName = (alt: string, name: string): string => (alt.trim() === '' ? name : alt)

/**
 * Écriture de l'admin (ADR 0005, 0010, 0011), mêmes règles et même ordre que UpdateSiteIdentity de
 * l'API Platform : les couleurs sont vérifiées avant l'encodage des images, une couleur refusée ne
 * laisse aucun fichier. La case « couleurs de la bibliothèque » ignore les couleurs saisies.
 * Langues (ADR 0014) : nom et accroche sont saisis dans la langue par défaut actuelle ; quand elle
 * change, ils passent en traduction et les autres modules échangent leurs textes (sans transaction :
 * la base de dev n'est pas un replica set). SiteRuleViolation ou MediaRuleViolation en cas de refus.
 */
export const updateSiteIdentity = async (
  dependencies: SiteDependencies,
  input: SiteIdentity.Input,
): Promise<void> => {
  const { media } = dependencies
  const current = await getSiteIdentity(dependencies)
  const colors = input.useLibraryColors
    ? null
    : brandColorsFromInput(input.primaryColor, input.secondaryColor)
  const locales = siteLocales([input.defaultLocale, ...input.otherLocales])
  const [from] = current.locales
  const { texts, translations } = switchDefaultLocale(
    { name: input.name, tagline: input.tagline },
    input.translations === undefined ? current.translations : keptTranslations(input.translations),
    from,
    locales[0],
  )
  const logo = input.removeLogo
    ? null
    : await changeImage(
        media,
        current.logo,
        input.imageContent,
        altOrName(input.imageAlt, input.name),
        false,
        'logo',
      )
  const shareImage = input.removeShareImage
    ? null
    : await changeImage(
        media,
        current.shareImage,
        input.shareImageContent,
        altOrName(input.shareImageAlt, input.name),
        false,
        'share',
      )
  const icon = input.removeIcon
    ? null
    : await changeImage(media, current.icon, input.iconContent, '', true, 'icon')

  if (from !== locales[0]) {
    await dependencies.switchContentLocale(from, locales[0])
  }
  await dependencies.siteIdentities.save({
    name: texts.name,
    tagline: texts.tagline,
    logo,
    colors,
    defaultColorScheme: input.defaultColorScheme,
    shareImage,
    icon,
    salesEnabled: input.salesEnabled,
    contactRecipient: input.contactRecipient,
    locales,
    translations,
  })
}
