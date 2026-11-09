import { keptTranslations, takenSlug } from '#/shared/domain/translations.ts'

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
import type { Translations, TranslationsInput } from '#/shared/domain/translations.ts'

/** Écritures de l'admin sur les articles, leurs rubriques et leurs formats (ADR 0001, 0009), mêmes messages que l'API Platform. */
export interface BlogAdminDependencies {
  readonly articles: Article.Repository
  readonly articleWriter: Article.Writer
  readonly articleRenderer: Article.Renderer
  readonly articleTerms: Article.TermRepository
  readonly media: MediaDependencies
}

/** Traductions à enregistrer : celles de la saisie, ou les actuelles quand la saisie n'en porte pas. */
const translationsOf = (
  input: TranslationsInput | undefined,
  current: Translations | undefined,
): Translations => (input === undefined ? (current ?? {}) : keptTranslations(input))

/** Slug libre dans chaque langue (ADR 0014) : le sien, et son slug traduit ou à défaut le même. */
const requireFreeSlug = async (
  { articleWriter }: BlogAdminDependencies,
  slug: string,
  translations: TranslationsInput,
  id?: number,
): Promise<void> => {
  const taken = await takenSlug(slug, translations, async (candidate, locale) => {
    const owner = await articleWriter.findBySlug(candidate, locale)
    return owner !== null && owner.id !== id
  })
  if (taken !== null) {
    throw new BlogRuleViolation('Le slug « %slug% » est déjà pris par un autre article.', {
      slug: taken,
    })
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
    throw termMissing(kind)
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
  translations: Translations,
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
    translations,
  }
}

export const createArticle = async (
  dependencies: BlogAdminDependencies,
  input: Article.Input,
): Promise<Article.Entity> => {
  const translations = translationsOf(input.translations, undefined)
  await requireFreeSlug(dependencies, input.slug, input.translations ?? {})
  return dependencies.articleWriter.create(await saved(dependencies, input, null, translations))
}

export const updateArticle = async (
  dependencies: BlogAdminDependencies,
  id: number,
  input: Article.Input,
): Promise<void> => {
  const current = await requireArticle(dependencies, id)
  const translations = translationsOf(input.translations, current.translations)
  await requireFreeSlug(dependencies, input.slug, input.translations ?? translations, id)
  await dependencies.articleWriter.update(
    id,
    await saved(dependencies, input, current, translations),
  )
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
    throw termMissing(kind)
  }
  return term
}

/** Slug libre dans sa liste et dans chaque langue (ADR 0014). */
const requireFreeTermSlug = async (
  { articleTerms }: BlogAdminDependencies,
  kind: Article.TermKind,
  slug: string,
  translations: TranslationsInput,
  id?: number,
): Promise<void> => {
  const taken = await takenSlug(slug, translations, async (candidate, locale) => {
    const owner = await articleTerms.findBySlug(kind, candidate, locale)
    return owner !== null && owner.id !== id
  })
  if (taken !== null) {
    throw termSlugTaken(kind, taken)
  }
}

export const createArticleTerm = async (
  dependencies: BlogAdminDependencies,
  kind: Article.TermKind,
  input: Article.TermInput,
): Promise<Article.Term> => {
  const translations = translationsOf(input.translations, undefined)
  await requireFreeTermSlug(dependencies, kind, input.slug, input.translations ?? {})
  return dependencies.articleTerms.create(kind, { ...input, translations })
}

export const updateArticleTerm = async (
  dependencies: BlogAdminDependencies,
  id: number,
  kind: Article.TermKind,
  input: Article.TermInput,
): Promise<void> => {
  const current = await requireTerm(dependencies, id, kind)
  const translations = translationsOf(input.translations, current.translations)
  await requireFreeTermSlug(dependencies, kind, input.slug, input.translations ?? translations, id)
  await dependencies.articleTerms.update(id, { ...input, translations })
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
    throw termUsedBy(kind, term.name, used)
  }
  await dependencies.articleTerms.remove(id)
}
