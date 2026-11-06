import { ContentRuleViolation } from '#/content/domain/contentRules.ts'
import { changeImage } from '#/media/application/storeImage.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Slide } from '#/content/domain/Slide.ts'
import type { MediaDependencies } from '#/media/application/storeImage.ts'

/**
 * Écritures de l'admin sur le carrousel et les pages légales (ADR 0001). Mêmes vérifications,
 * dans le même ordre et avec les mêmes messages que l'API Platform.
 */
export interface ContentAdminDependencies {
  readonly slideWriter: Slide.Writer
  readonly legalPageWriter: LegalPage.Writer
  readonly legalPageRenderer: LegalPage.Renderer
  readonly media: MediaDependencies
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
  const slide = await slideWriter.findById(id)
  if (slide === null) {
    throw new ContentRuleViolation("Cette diapositive n'existe plus.")
  }
  return slide
}

/** Diapositive à enregistrer : l'image envoyée, ou l'actuelle avec son nouveau texte (MediaRuleViolation sinon). */
const saved = async (
  { media }: ContentAdminDependencies,
  input: Slide.Input,
  current: Slide.Editable | null,
): Promise<Slide.Saved> => {
  const { slug, title, text, position, imageContent, imageAlt, imageDecorative } = input
  const image = await changeImage(
    media,
    current?.image ?? null,
    imageContent,
    imageAlt,
    imageDecorative,
    'slide',
  )
  if (image === null) {
    throw new ContentRuleViolation("Une diapositive a besoin d'une image.")
  }
  return { slug, title, text, position, image }
}

export const createSlide = async (
  dependencies: ContentAdminDependencies,
  input: Slide.Input,
): Promise<Slide.Editable> => {
  await requireFreeSlug(dependencies, input.slug)
  return dependencies.slideWriter.create(await saved(dependencies, input, null))
}

export const updateSlide = async (
  dependencies: ContentAdminDependencies,
  id: number,
  input: Slide.Input,
): Promise<void> => {
  const current = await requireSlide(dependencies, id)
  await requireFreeSlug(dependencies, input.slug, id)
  await dependencies.slideWriter.update(id, await saved(dependencies, input, current))
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
