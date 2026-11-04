import { describe, expect, it } from 'vitest'

import { BlogRuleViolation } from '#/blog/domain/Article.ts'
import { createArticle, deleteArticle, updateArticle } from '#/blog/application/adminBlog.ts'
import { readArticleForm } from '#/blog/http/adminBlog.ts'

import type { Article } from '#/blog/domain/Article.ts'

const blog = () => {
  let articles: Article.Entity[] = [
    { id: 1, slug: 'rempoter', title: 'Rempoter', excerpt: '', publishedAt: '2026-01-10' },
  ]
  const articleWriter: Article.Writer = {
    findById: (id) => Promise.resolve(articles.find((a) => a.id === id) ?? null),
    findBySlug: (slug) => Promise.resolve(articles.find((a) => a.slug === slug) ?? null),
    create: (input) => {
      const article = { id: articles.length + 1, ...input }
      articles = [...articles, article]
      return Promise.resolve(article)
    },
    update: (id, input) => {
      articles = articles.map((a) => (a.id === id ? { id, ...input } : a))
      return Promise.resolve()
    },
    remove: (id) => {
      articles = articles.filter((a) => a.id !== id)
      return Promise.resolve()
    },
  }
  return {
    dependencies: { articles: { findLatestFirst: () => Promise.resolve(articles) }, articleWriter },
    all: () => articles,
  }
}

const input = (slug: string): Article.Input => ({
  slug,
  title: 'Titre',
  excerpt: '',
  publishedAt: '2026-02-01',
})

describe('Admin : blog', () => {
  it('refuse un slug déjà pris par un autre article, accepte le sien', async () => {
    const { dependencies } = blog()

    await expect(createArticle(dependencies, input('rempoter'))).rejects.toThrow(
      new BlogRuleViolation('Le slug « rempoter » est déjà pris par un autre article.'),
    )
    await expect(updateArticle(dependencies, 1, input('rempoter'))).resolves.toBeUndefined()
  })

  it('refuse de modifier ou supprimer un article disparu', async () => {
    const { dependencies } = blog()

    await expect(updateArticle(dependencies, 9, input('autre'))).rejects.toThrow(
      "Cet article n'existe plus.",
    )
    await expect(deleteArticle(dependencies, 9)).rejects.toThrow("Cet article n'existe plus.")
  })

  it('crée puis supprime un article', async () => {
    const { dependencies, all } = blog()

    const created = await createArticle(dependencies, input('arroser'))
    await deleteArticle(dependencies, created.id)

    expect(all().map((a) => a.slug)).toEqual(['rempoter'])
  })

  it('refuse une date de publication qui n’existe pas', () => {
    const form = readArticleForm({ title: 'T', slug: 't', excerpt: '', publishedAt: '2026-02-30' })

    expect(form.data).toBeNull()
    expect(form.errors.publishedAt).toBe('Veuillez entrer une date valide.')
  })
})
