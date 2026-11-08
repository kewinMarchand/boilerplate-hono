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

/**
 * Écriture de l'admin (ADR 0005), mêmes règles et même ordre que UpdateSiteIdentity de l'API
 * Platform : les couleurs sont vérifiées avant l'encodage du logo, une saisie refusée ne laisse
 * aucun fichier. SiteRuleViolation ou MediaRuleViolation en cas de refus.
 */
export const updateSiteIdentity = async (
  dependencies: SiteDependencies,
  input: SiteIdentity.Input,
): Promise<void> => {
  const current = await getSiteIdentity(dependencies)
  const colors = brandColorsFromInput(input.primaryColor, input.secondaryColor)
  const alt = input.imageAlt.trim() === '' ? input.name : input.imageAlt
  const logo = input.removeLogo
    ? null
    : await changeImage(dependencies.media, current.logo, input.imageContent, alt, false, 'logo')

  await dependencies.siteIdentities.save({
    name: input.name,
    tagline: input.tagline,
    logo,
    colors,
    defaultColorScheme: input.defaultColorScheme,
  })
}
