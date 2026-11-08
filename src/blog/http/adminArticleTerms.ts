import { Hono } from 'hono'
import { html } from 'hono/html'

import { field, integer, maxLength, textField } from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'

import { BlogRuleViolation } from '#/blog/domain/Article.ts'
import {
  createArticleTerm,
  deleteArticleTerm,
  updateArticleTerm,
} from '#/blog/application/adminBlog.ts'

import type { BlogAdminDependencies } from '#/blog/application/adminBlog.ts'
import type { Article } from '#/blog/domain/Article.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

/**
 * Rubriques et formats des articles (ADR 0009) : deux sections de l'admin, une par liste, mêmes
 * pages et mêmes cas d'usage, la sorte en paramètre (ArticleTermCrudController de l'API Platform).
 * Forme vérifiée ici avec les contraintes d'ArticleTermType.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,59}$/
const NAME_MAX_LENGTH = 60

interface Wording {
  readonly path: string
  readonly plural: string
  readonly created: string
  readonly modified: string
  readonly deleted: string
  readonly newTitle: string
  readonly newLink: string
  readonly editTitle: string
  readonly deleteQuestion: (name: string) => string
}

const WORDING: Record<Article.TermKind, Wording> = {
  section: {
    path: '/admin/rubriques',
    plural: 'Rubriques',
    created: 'Rubrique créée.',
    modified: 'Rubrique modifiée.',
    deleted: 'Rubrique supprimée.',
    newTitle: 'Nouvelle rubrique',
    newLink: 'Nouvelle rubrique',
    editTitle: 'Modifier la rubrique',
    deleteQuestion: (name) => `La rubrique « ${name} » sera supprimée.`,
  },
  format: {
    path: '/admin/formats',
    plural: 'Formats',
    created: 'Format créé.',
    modified: 'Format modifié.',
    deleted: 'Format supprimé.',
    newTitle: 'Nouveau format',
    newLink: 'Nouveau format',
    editTitle: 'Modifier le format',
    deleteQuestion: (name) => `Le format « ${name} » sera supprimé.`,
  },
}

export const readArticleTermForm = (
  body: Record<string, unknown>,
): FormResult<Article.TermInput> => {
  const values: Values = {
    name: field(body, 'name'),
    slug: field(body, 'slug'),
    position: field(body, 'position'),
  }
  const errors: Errors = {}
  if (values.name === '') {
    errors.name = 'Cette valeur ne doit pas être vide.'
  }
  maxLength(errors, 'name', values.name ?? '', NAME_MAX_LENGTH)
  if (values.slug === '') {
    errors.slug = 'Cette valeur ne doit pas être vide.'
  } else if (!SLUG_PATTERN.test(values.slug ?? '')) {
    errors.slug = 'Minuscules, chiffres et tirets, 60 caractères au plus, sans tiret au début.'
  }
  const position = integer(values.position ?? '')
  if (position === null) {
    errors.position = 'Cette valeur doit être un nombre entier.'
  } else if (position < 0) {
    errors.position = 'Cette valeur doit être positive ou nulle.'
  }
  const data =
    Object.keys(errors).length === 0 && position !== null
      ? { name: values.name ?? '', slug: values.slug ?? '', position }
      : null

  return { values, errors, data }
}

const listPage = (
  wording: Wording,
  terms: readonly Article.Term[],
  message?: string,
  error?: string,
) =>
  adminPage(
    wording.plural,
    wording.path,
    html`<h1>${wording.plural}</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="${wording.path}/nouveau">${wording.newLink}</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Slug</th>
            <th scope="col">Position</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${terms.map(
            (term) =>
              html`<tr>
                <td>${term.name}</td>
                <td>${term.slug}</td>
                <td>${term.position}</td>
                <td>
                  <a href="${wording.path}/${term.id}/modifier"
                    >Modifier<span class="sr"> ${term.name}</span></a
                  >
                  ·
                  <a href="${wording.path}/${term.id}/supprimer"
                    >Supprimer<span class="sr"> ${term.name}</span></a
                  >
                </td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

const formPage = (
  wording: Wording,
  title: string,
  action: string,
  values: Values,
  errors: Errors = {},
  error?: string,
) =>
  adminPage(
    title,
    wording.path,
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" novalidate>
        ${textField('Nom', 'name', values, errors)} ${textField('Slug', 'slug', values, errors)}
        <p>
          Minuscules, chiffres et tirets, 60 caractères au plus : il apparaît dans les adresses du
          blog.
        </p>
        ${textField('Position', 'position', values, errors, 'number')}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="${wording.path}">Retour aux ${wording.plural.toLowerCase()}</a></p>`,
  )

const confirmPage = (wording: Wording, term: Article.Term, action: string) =>
  adminPage(
    `Supprimer « ${term.name} »`,
    wording.path,
    html`<h1>Supprimer « ${term.name} »</h1>
      <p>${wording.deleteQuestion(term.name)}</p>
      <form method="post" action="${action}">
        <button type="submit" class="danger">Supprimer</button>
      </form>
      <p><a href="${wording.path}">Annuler</a></p>`,
  )

const refusal = (error: unknown): string => {
  if (error instanceof BlogRuleViolation) {
    return error.message
  }
  throw error
}

const termId = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null)

export const adminArticleTermRoutes = (
  dependencies: BlogAdminDependencies,
  kind: Article.TermKind,
) => {
  const app = new Hono()
  const wording = WORDING[kind]
  const done: Record<string, string> = {
    cree: wording.created,
    modifie: wording.modified,
    supprime: wording.deleted,
  }
  const list = () => dependencies.articleTerms.findByKind(kind)
  const find = async (value: string) => {
    const id = termId(value)
    const term = id === null ? null : await dependencies.articleTerms.findById(id)
    return term?.kind === kind ? term : null
  }

  app.get(wording.path, async (c) => {
    const ok = c.req.query('ok')
    return c.html(listPage(wording, await list(), ok === undefined ? undefined : done[ok]))
  })

  app.get(`${wording.path}/nouveau`, (c) =>
    c.html(formPage(wording, wording.newTitle, c.req.path, { position: '0' })),
  )

  app.post(`${wording.path}/nouveau`, async (c) => {
    const form = readArticleTermForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(formPage(wording, wording.newTitle, c.req.path, form.values, form.errors), 422)
    }
    try {
      await createArticleTerm(dependencies, kind, form.data)
    } catch (error) {
      return c.html(
        formPage(wording, wording.newTitle, c.req.path, form.values, {}, refusal(error)),
        422,
      )
    }
    return c.redirect(`${wording.path}?ok=cree`, 303)
  })

  app.get(`${wording.path}/:id/modifier`, async (c) => {
    const term = await find(c.req.param('id'))
    return term === null
      ? c.html(notFoundPage(), 404)
      : c.html(
          formPage(wording, `Modifier « ${term.name} »`, c.req.path, {
            name: term.name,
            slug: term.slug,
            position: String(term.position),
          }),
        )
  })

  app.post(`${wording.path}/:id/modifier`, async (c) => {
    const id = termId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    const title = wording.editTitle
    const form = readArticleTermForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(formPage(wording, title, c.req.path, form.values, form.errors), 422)
    }
    try {
      await updateArticleTerm(dependencies, id, kind, form.data)
    } catch (error) {
      return c.html(formPage(wording, title, c.req.path, form.values, {}, refusal(error)), 422)
    }
    return c.redirect(`${wording.path}?ok=modifie`, 303)
  })

  app.get(`${wording.path}/:id/supprimer`, async (c) => {
    const term = await find(c.req.param('id'))
    return term === null
      ? c.html(notFoundPage(), 404)
      : c.html(confirmPage(wording, term, c.req.path))
  })

  app.post(`${wording.path}/:id/supprimer`, async (c) => {
    const id = termId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    try {
      await deleteArticleTerm(dependencies, id, kind)
    } catch (error) {
      return c.html(listPage(wording, await list(), undefined, refusal(error)), 422)
    }
    return c.redirect(`${wording.path}?ok=supprime`, 303)
  })

  return app
}
