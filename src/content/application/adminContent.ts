import { keptTranslations } from '#/shared/domain/translations.ts'

import { ContentRuleViolation } from '#/content/domain/contentRules.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { PageMeta } from '#/content/domain/PageMeta.ts'

/**
 * Écritures de l'admin sur les pages légales (ADR 0001) et le référencement des pages fixes
 * (ADR 0010). Mêmes vérifications, dans le même ordre et avec les mêmes messages que l'API Platform.
 */
export interface ContentAdminDependencies {
  readonly legalPageWriter: LegalPage.Writer
  readonly legalPageRenderer: LegalPage.Renderer
  readonly pageMetaWriter: PageMeta.Writer
}

/** Traductions absentes de la saisie : celles de la page sont gardées. */
export const updateLegalPage = async (
  { legalPageWriter, legalPageRenderer }: ContentAdminDependencies,
  slug: string,
  { title, body, translations }: LegalPage.Input,
): Promise<void> => {
  const current = await legalPageWriter.findEditable(slug)
  if (current === null) {
    throw new ContentRuleViolation("Cette page n'existe plus.")
  }
  await legalPageWriter.update(slug, {
    title,
    body,
    translations:
      translations === undefined ? current.translations : keptTranslations(translations),
    ...legalPageRenderer.split(body),
  })
}

/** Référencement d'une page fixe, enregistré sans blancs de début ni de fin. */
export const updatePageMeta = async (
  { pageMetaWriter }: ContentAdminDependencies,
  page: PageMeta.Page,
  input: PageMeta.Input,
): Promise<void> => {
  const current = await pageMetaWriter.find(page)
  if (current === null) {
    throw new ContentRuleViolation("Cette page n'existe plus.")
  }
  await pageMetaWriter.update(page, {
    title: input.title.trim(),
    description: input.description.trim(),
    translations:
      input.translations === undefined
        ? current.translations
        : keptTranslations(input.translations),
  })
}
