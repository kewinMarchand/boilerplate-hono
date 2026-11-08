import { Hono } from 'hono'
import { html } from 'hono/html'

import { metaFieldsHtml, readMetaFields } from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'

import { ContentRuleViolation } from '#/content/domain/contentRules.ts'
import { isMetaPage, META_PAGES, metaPageLabel } from '#/content/domain/PageMeta.ts'
import { updatePageMeta } from '#/content/application/adminContent.ts'

import type { ContentAdminDependencies } from '#/content/application/adminContent.ts'
import type { PageMeta } from '#/content/domain/PageMeta.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

/**
 * Référencement des pages fixes (ADR 0010) : une fiche par page, en modification seule, comme
 * PageMetaCrudController de l'API Platform. Longueurs vérifiées ici (60 et 160 caractères).
 */
const PATH = '/admin/referencement'
const TITLE = 'Référencement'

export const readPageMetaForm = (body: Record<string, unknown>): FormResult<PageMeta.Input> => {
  const values: Values = {}
  const errors: Errors = {}
  const { title, description } = readMetaFields(body, values, errors, 'title', 'description')

  return { values, errors, data: Object.keys(errors).length === 0 ? { title, description } : null }
}

const listPage = (metas: readonly PageMeta.Entity[], message?: string) => {
  const saved = new Map(metas.map((meta) => [meta.page, meta]))
  return adminPage(
    TITLE,
    PATH,
    html`<h1>${TITLE}</h1>
      ${flash(message)}
      <p>Vide : le front garde son titre et sa description.</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Titre</th>
            <th scope="col">Description</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${META_PAGES.map(
            ([page, label]) =>
              html`<tr>
                <td>${label}</td>
                <td>${saved.get(page)?.title ?? ''}</td>
                <td>${saved.get(page)?.description ?? ''}</td>
                <td>
                  <a href="${PATH}/${page}/modifier">Modifier<span class="sr"> ${label}</span></a>
                </td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )
}

const formPage = (
  page: PageMeta.Page,
  action: string,
  values: Values,
  errors: Errors = {},
  error?: string,
) => {
  const title = `Référencement de « ${metaPageLabel(page)} »`
  return adminPage(
    title,
    PATH,
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" novalidate>
        ${metaFieldsHtml(values, errors, 'title', 'description')}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="${PATH}">Retour au référencement</a></p>`,
  )
}

const refusal = (error: unknown): string => {
  if (error instanceof ContentRuleViolation) {
    return error.message
  }
  throw error
}

export const adminPageMetaRoutes = (dependencies: ContentAdminDependencies) => {
  const app = new Hono()

  app.get(PATH, async (c) => {
    const ok = c.req.query('ok')
    const metas = await dependencies.pageMetaWriter.findAll()
    return c.html(listPage(metas, ok === 'modifie' ? 'Référencement enregistré.' : undefined))
  })

  app.get(`${PATH}/:page/modifier`, async (c) => {
    const page = c.req.param('page')
    const meta = isMetaPage(page) ? await dependencies.pageMetaWriter.find(page) : null
    return meta === null
      ? c.html(notFoundPage(), 404)
      : c.html(
          formPage(meta.page, c.req.path, { title: meta.title, description: meta.description }),
        )
  })

  app.post(`${PATH}/:page/modifier`, async (c) => {
    const page = c.req.param('page')
    if (!isMetaPage(page)) {
      return c.html(notFoundPage(), 404)
    }
    const form = readPageMetaForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(formPage(page, c.req.path, form.values, form.errors), 422)
    }
    try {
      await updatePageMeta(dependencies, page, form.data)
    } catch (error) {
      return c.html(formPage(page, c.req.path, form.values, {}, refusal(error)), 422)
    }
    return c.redirect(`${PATH}?ok=modifie`, 303)
  })

  return app
}
