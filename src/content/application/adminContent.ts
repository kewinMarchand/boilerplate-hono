import { ContentRuleViolation } from '#/content/domain/contentRules.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'

/**
 * Écritures de l'admin sur les pages légales (ADR 0001). Mêmes vérifications,
 * dans le même ordre et avec les mêmes messages que l'API Platform.
 */
export interface ContentAdminDependencies {
  readonly legalPageWriter: LegalPage.Writer
  readonly legalPageRenderer: LegalPage.Renderer
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
