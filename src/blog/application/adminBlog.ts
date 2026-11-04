import { BlogRuleViolation } from '#/blog/domain/Article.ts'

import type { Article } from '#/blog/domain/Article.ts'

/** Écritures de l'admin sur les articles (ADR 0001), mêmes messages que l'API Platform. */
export interface BlogAdminDependencies {
  readonly articles: Article.Repository
  readonly articleWriter: Article.Writer
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
  if ((await articleWriter.findById(id)) === null) {
    throw new BlogRuleViolation("Cet article n'existe plus.")
  }
}

export const createArticle = async (
  dependencies: BlogAdminDependencies,
  input: Article.Input,
): Promise<Article.Entity> => {
  await requireFreeSlug(dependencies, input.slug)
  return dependencies.articleWriter.create(input)
}

export const updateArticle = async (
  dependencies: BlogAdminDependencies,
  id: number,
  input: Article.Input,
): Promise<void> => {
  await requireArticle(dependencies, id)
  await requireFreeSlug(dependencies, input.slug, id)
  await dependencies.articleWriter.update(id, input)
}

export const deleteArticle = async (
  dependencies: BlogAdminDependencies,
  id: number,
): Promise<void> => {
  await requireArticle(dependencies, id)
  await dependencies.articleWriter.remove(id)
}
