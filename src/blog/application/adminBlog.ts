import {
  BlogRuleViolation,
  speakerOf,
  termMissing,
  termSlugTaken,
  termUsedBy,
} from '#/blog/domain/Article.ts'
import { storeAudio } from '#/media/application/storeAudio.ts'
import { changeImage } from '#/media/application/storeImage.ts'

import type { Article } from '#/blog/domain/Article.ts'
import type { MediaDependencies } from '#/media/application/storeImage.ts'
import type { Media } from '#/media/domain/Media.ts'

/** Écritures de l'admin sur les articles, leurs rubriques et leurs formats (ADR 0001, 0009), mêmes messages que l'API Platform. */
export interface BlogAdminDependencies {
  readonly articles: Article.Repository
  readonly articleWriter: Article.Writer
  readonly articleRenderer: Article.Renderer
  readonly articleTerms: Article.TermRepository
  readonly media: MediaDependencies
}

const requireFreeSlug = async (
  { articleWriter }: BlogAdminDependencies,
  slug: string,
  id?: number,
): Promise<void> => {
  const sameSlug = await articleWriter.findBySlug(slug)
  if (sameSlug !== null && sameSlug.id !== id) {
    throw new BlogRuleViolation(`Le slug « ${slug} » est déjà pris par un autre article.`)
  }
}

const requireArticle = async ({ articleWriter }: BlogAdminDependencies, id: number) => {
  const article = await articleWriter.findById(id)
  if (article === null) {
    throw new BlogRuleViolation("Cet article n'existe plus.")
  }
  return article
}

/** Rubrique ou format choisi : il doit exister dans sa liste (« Cette rubrique n'existe plus. » sinon). */
const chosenTerm = async (
  { articleTerms }: BlogAdminDependencies,
  kind: Article.TermKind,
  id: number | null,
): Promise<number | null> => {
  if (id === null) {
    return null
  }
  const term = await articleTerms.findById(id)
  if (term === null || term.kind !== kind) {
    throw new BlogRuleViolation(termMissing(kind))
  }
  return term.id
}

/** Audio après la saisie : retiré, remplacé par le fichier envoyé, ou gardé. */
const chosenAudio = async (
  media: MediaDependencies,
  input: Article.Input,
  current: Media.Audio | null,
): Promise<Media.Audio | null> => {
  if (input.removeAudio) {
    return null
  }
  return input.audioContent === null ? current : storeAudio(media, input.audioContent)
}

/**
 * Article à enregistrer, dans l'ordre de CreateArticle et UpdateArticle de l'API Platform : rubrique
 * et format, image, fichier audio, puis intervenant et référencement (sans blancs de début ni de fin).
 */
const saved = async (
  dependencies: BlogAdminDependencies,
  input: Article.Input,
  current: Article.Entity | null,
): Promise<Article.Saved> => {
  const { media, articleRenderer } = dependencies
  const { slug, title, excerpt, publishedAt, imageContent, imageAlt, imageDecorative, body } = input
  const sectionId = await chosenTerm(dependencies, 'section', input.sectionId)
  const formatId = await chosenTerm(dependencies, 'format', input.formatId)
  const image = await changeImage(
    media,
    current?.image ?? null,
    imageContent,
    imageAlt,
    imageDecorative,
    'article',
  )
  if (image === null) {
    throw new BlogRuleViolation("Un article a besoin d'une image.")
  }
  const audio = await chosenAudio(media, input, current?.audio ?? null)

  return {
    slug,
    title,
    excerpt,
    publishedAt,
    image,
    body,
    html: articleRenderer.render(body),
    sectionId,
    formatId,
    audio,
    speaker: speakerOf(input.speaker),
    metaTitle: input.metaTitle.trim(),
    metaDescription: input.metaDescription.trim(),
  }
}

export const createArticle = async (
  dependencies: BlogAdminDependencies,
  input: Article.Input,
): Promise<Article.Entity> => {
  await requireFreeSlug(dependencies, input.slug)
  return dependencies.articleWriter.create(await saved(dependencies, input, null))
}

export const updateArticle = async (
  dependencies: BlogAdminDependencies,
  id: number,
  input: Article.Input,
): Promise<void> => {
  const current = await requireArticle(dependencies, id)
  await requireFreeSlug(dependencies, input.slug, id)
  await dependencies.articleWriter.update(id, await saved(dependencies, input, current))
}

export const deleteArticle = async (
  dependencies: BlogAdminDependencies,
  id: number,
): Promise<void> => {
  await requireArticle(dependencies, id)
  await dependencies.articleWriter.remove(id)
}

const requireTerm = async (
  { articleTerms }: BlogAdminDependencies,
  id: number,
  kind: Article.TermKind,
): Promise<Article.Term> => {
  const term = await articleTerms.findById(id)
  if (term === null || term.kind !== kind) {
    throw new BlogRuleViolation(termMissing(kind))
  }
  return term
}

export const createArticleTerm = async (
  dependencies: BlogAdminDependencies,
  kind: Article.TermKind,
  input: Article.TermInput,
): Promise<Article.Term> => {
  if ((await dependencies.articleTerms.findBySlug(kind, input.slug)) !== null) {
    throw new BlogRuleViolation(termSlugTaken(kind, input.slug))
  }
  return dependencies.articleTerms.create(kind, input)
}

export const updateArticleTerm = async (
  dependencies: BlogAdminDependencies,
  id: number,
  kind: Article.TermKind,
  input: Article.TermInput,
): Promise<void> => {
  await requireTerm(dependencies, id, kind)
  const sameSlug = await dependencies.articleTerms.findBySlug(kind, input.slug)
  if (sameSlug !== null && sameSlug.id !== id) {
    throw new BlogRuleViolation(termSlugTaken(kind, input.slug))
  }
  await dependencies.articleTerms.update(id, input)
}

/** Refuse de supprimer un terme porté par un article ; compte fait sur la liste des articles, comme en PHP. */
export const deleteArticleTerm = async (
  dependencies: BlogAdminDependencies,
  id: number,
  kind: Article.TermKind,
): Promise<void> => {
  const term = await requireTerm(dependencies, id, kind)
  const used = (await dependencies.articles.findLatestFirst()).filter(
    ({ section, format }) => section?.id === id || format?.id === id,
  ).length
  if (used > 0) {
    throw new BlogRuleViolation(termUsedBy(kind, term.name, used))
  }
  await dependencies.articleTerms.remove(id)
}
