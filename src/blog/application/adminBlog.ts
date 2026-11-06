import { BlogRuleViolation } from '#/blog/domain/Article.ts'
import { changeImage } from '#/media/application/storeImage.ts'

import type { Article } from '#/blog/domain/Article.ts'
import type { MediaDependencies } from '#/media/application/storeImage.ts'

/** Écritures de l'admin sur les articles (ADR 0001), mêmes messages que l'API Platform. */
export interface BlogAdminDependencies {
  readonly articles: Article.Repository
  readonly articleWriter: Article.Writer
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

/** Article à enregistrer : l'image envoyée, ou l'actuelle avec son nouveau texte (MediaRuleViolation sinon). */
const saved = async (
  { media }: BlogAdminDependencies,
  input: Article.Input,
  current: Article.Entity | null,
): Promise<Article.Saved> => {
  const { slug, title, excerpt, publishedAt, imageContent, imageAlt, imageDecorative } = input
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
  return { slug, title, excerpt, publishedAt, image }
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
