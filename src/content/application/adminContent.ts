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

export const updateLegalPage = async (
  { legalPageWriter, legalPageRenderer }: ContentAdminDependencies,
  slug: string,
  input: LegalPage.Input,
): Promise<void> => {
  if ((await legalPageWriter.findEditable(slug)) === null) {
    throw new ContentRuleViolation("Cette page n'existe plus.")
  }
  await legalPageWriter.update(slug, { ...input, ...legalPageRenderer.split(input.body) })
}

/** Référencement d'une page fixe, enregistré sans blancs de début ni de fin. */
export const updatePageMeta = async (
  { pageMetaWriter }: ContentAdminDependencies,
  page: PageMeta.Page,
  input: PageMeta.Input,
): Promise<void> => {
  if ((await pageMetaWriter.find(page)) === null) {
    throw new ContentRuleViolation("Cette page n'existe plus.")
  }
  await pageMetaWriter.update(page, {
    title: input.title.trim(),
    description: input.description.trim(),
  })
}
