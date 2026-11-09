import { brandColorsFromInput } from '#/site/domain/brandColors.ts'
import { DEFAULT_SITE_IDENTITY } from '#/site/domain/SiteIdentity.ts'
import { changeImage } from '#/media/application/storeImage.ts'

import type { MediaDependencies } from '#/media/application/storeImage.ts'
import type { SiteIdentity } from '#/site/domain/SiteIdentity.ts'

export interface SiteDependencies {
  readonly siteIdentities: SiteIdentity.Repository
  readonly media: MediaDependencies
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
 * SiteRuleViolation ou MediaRuleViolation en cas de refus.
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

  await dependencies.siteIdentities.save({
    name: input.name,
    tagline: input.tagline,
    logo,
    colors,
    defaultColorScheme: input.defaultColorScheme,
    shareImage,
    icon,
    salesEnabled: input.salesEnabled,
    contactRecipient: input.contactRecipient,
    locales: current.locales,
    translations: current.translations,
  })
}
