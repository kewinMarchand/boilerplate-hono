import { checkImage, ContentRuleViolation } from '#/content/domain/contentRules.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Slide } from '#/content/domain/Slide.ts'

/**
 * Écritures de l'admin sur le carrousel et les pages légales (ADR 0001). Mêmes vérifications,
 * dans le même ordre et avec les mêmes messages que l'API Platform.
 */
export interface ContentAdminDependencies {
  readonly slideWriter: Slide.Writer
  readonly legalPageWriter: LegalPage.Writer
  readonly legalPageRenderer: LegalPage.Renderer
}

const requireFreeSlug = async (
  { slideWriter }: ContentAdminDependencies,
  slug: string,
  id?: number,
): Promise<void> => {
  const sameSlug = await slideWriter.findBySlug(slug)
  if (sameSlug !== null && sameSlug.id !== id) {
    throw new ContentRuleViolation(`Le slug « ${slug} » est déjà pris par une autre diapositive.`)
  }
}

const requireSlide = async ({ slideWriter }: ContentAdminDependencies, id: number) => {
  if ((await slideWriter.findById(id)) === null) {
    throw new ContentRuleViolation("Cette diapositive n'existe plus.")
  }
}

export const createSlide = async (
  dependencies: ContentAdminDependencies,
  input: Slide.Input,
): Promise<Slide.Editable> => {
  await requireFreeSlug(dependencies, input.slug)
  checkImage(input.image)
  return dependencies.slideWriter.create(input)
}

export const updateSlide = async (
  dependencies: ContentAdminDependencies,
  id: number,
  input: Slide.Input,
): Promise<void> => {
  await requireSlide(dependencies, id)
  await requireFreeSlug(dependencies, input.slug, id)
  checkImage(input.image)
  await dependencies.slideWriter.update(id, input)
}

export const deleteSlide = async (
  dependencies: ContentAdminDependencies,
  id: number,
): Promise<void> => {
  await requireSlide(dependencies, id)
  await dependencies.slideWriter.remove(id)
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
