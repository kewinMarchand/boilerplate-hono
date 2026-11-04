import { Hono } from 'hono'
import { html } from 'hono/html'

import {
  field,
  requiredText,
  slugField,
  textareaField,
  textField,
} from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'

import { BlogRuleViolation } from '#/blog/domain/Article.ts'
import { createArticle, deleteArticle, updateArticle } from '#/blog/application/adminBlog.ts'

import type { BlogAdminDependencies } from '#/blog/application/adminBlog.ts'
import type { Article } from '#/blog/domain/Article.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

/**
 * Admin des articles du blog (ADR 0001) : liste, création, modification, suppression, montées par
 * l'admin derrière sa session. La forme est vérifiée ici, les règles par les cas d'usage.
 */
const DONE: Record<string, string> = {
  cree: 'Article créé.',
  modifie: 'Article modifié.',
  supprime: 'Article supprimé.',
}

const isDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

export const readArticleForm = (body: Record<string, unknown>): FormResult<Article.Input> => {
  const values = {
    title: field(body, 'title'),
    slug: field(body, 'slug'),
    excerpt: field(body, 'excerpt'),
    publishedAt: field(body, 'publishedAt'),
  }
  const errors: Errors = {}
  requiredText(errors, 'title', values.title)
  slugField(errors, values.slug)
  if (!isDate(values.publishedAt)) {
    errors.publishedAt = 'Veuillez entrer une date valide.'
  }

  return { values, errors, data: Object.keys(errors).length === 0 ? values : null }
}

const listPage = (articles: readonly Article.Entity[], message?: string, error?: string) =>
  adminPage(
    'Articles',
    '/admin/articles',
    html`<h1>Articles</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/articles/nouveau">Nouvel article</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">Titre</th>
            <th scope="col">Publié le</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${articles.map(
            (article) =>
              html`<tr>
                <td>${article.title}</td>
                <td>${article.publishedAt}</td>
                <td>
                  <a href="/admin/articles/${article.id}/modifier"
                    >Modifier<span class="sr"> ${article.title}</span></a
                  >
                  ·
                  <a href="/admin/articles/${article.id}/supprimer"
                    >Supprimer<span class="sr"> ${article.title}</span></a
                  >
                </td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

const formPage = (
  title: string,
  action: string,
  values: Values,
  errors: Errors = {},
  error?: string,
) =>
  adminPage(
    title,
    '/admin/articles',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" novalidate>
        ${textField('Titre', 'title', values, errors)} ${textField('Slug', 'slug', values, errors)}
        ${textareaField('Résumé', 'excerpt', values, errors)}
        ${textField('Date de publication', 'publishedAt', values, errors, 'date')}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="/admin/articles">Retour aux articles</a></p>`,
  )

const confirmPage = (article: Article.Entity, action: string) =>
  adminPage(
    `Supprimer « ${article.title} »`,
    '/admin/articles',
    html`<h1>Supprimer « ${article.title} »</h1>
      <p>L'article « ${article.title} » sera supprimé du blog.</p>
      <form method="post" action="${action}">
        <button type="submit" class="danger">Supprimer</button>
      </form>
      <p><a href="/admin/articles">Annuler</a></p>`,
  )

const valuesOf = ({ title, slug, excerpt, publishedAt }: Article.Entity): Values => ({
  title,
  slug,
  excerpt,
  publishedAt,
})

const refusal = (error: unknown): string => {
  if (error instanceof BlogRuleViolation) {
    return error.message
  }
  throw error
}

const articleId = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null)

export const adminBlogRoutes = (dependencies: BlogAdminDependencies) => {
  const app = new Hono()
  const list = () => dependencies.articles.findLatestFirst()
  const find = async (value: string) => {
    const id = articleId(value)
    return id === null ? null : dependencies.articleWriter.findById(id)
  }

  app.get('/admin/articles', async (c) => {
    const ok = c.req.query('ok')
    return c.html(listPage(await list(), ok === undefined ? undefined : DONE[ok]))
  })

  app.get('/admin/articles/nouveau', (c) =>
    c.html(
      formPage('Nouvel article', c.req.path, {
        publishedAt: new Date().toISOString().slice(0, 10),
      }),
    ),
  )

  app.post('/admin/articles/nouveau', async (c) => {
    const form = readArticleForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(formPage('Nouvel article', c.req.path, form.values, form.errors), 422)
    }
    try {
      await createArticle(dependencies, form.data)
    } catch (error) {
      return c.html(formPage('Nouvel article', c.req.path, form.values, {}, refusal(error)), 422)
    }
    return c.redirect('/admin/articles?ok=cree', 303)
  })

  app.get('/admin/articles/:id/modifier', async (c) => {
    const article = await find(c.req.param('id'))
    return article === null
      ? c.notFound()
      : c.html(formPage(`Modifier « ${article.title} »`, c.req.path, valuesOf(article)))
  })

  app.post('/admin/articles/:id/modifier', async (c) => {
    const id = articleId(c.req.param('id'))
    if (id === null) {
      return c.notFound()
    }
    const form = readArticleForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(formPage("Modifier l'article", c.req.path, form.values, form.errors), 422)
    }
    try {
      await updateArticle(dependencies, id, form.data)
    } catch (error) {
      return c.html(
        formPage("Modifier l'article", c.req.path, form.values, {}, refusal(error)),
        422,
      )
    }
    return c.redirect('/admin/articles?ok=modifie', 303)
  })

  app.get('/admin/articles/:id/supprimer', async (c) => {
    const article = await find(c.req.param('id'))
    return article === null ? c.notFound() : c.html(confirmPage(article, c.req.path))
  })

  app.post('/admin/articles/:id/supprimer', async (c) => {
    const id = articleId(c.req.param('id'))
    if (id === null) {
      return c.notFound()
    }
    try {
      await deleteArticle(dependencies, id)
    } catch (error) {
      return c.html(listPage(await list(), undefined, refusal(error)), 422)
    }
    return c.redirect('/admin/articles?ok=supprime', 303)
  })

  return app
}
