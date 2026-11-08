import { Hono } from 'hono'
import { html } from 'hono/html'

import { field, requiredText, textareaField, textField } from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'

import { ContentRuleViolation } from '#/content/domain/contentRules.ts'
import { updateLegalPage } from '#/content/application/adminContent.ts'

import { adminPageMetaRoutes } from './adminPageMeta.ts'

import type { ContentAdminDependencies } from '#/content/application/adminContent.ts'
import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

/**
 * Admin des pages légales (liste, modification seulement, comme l'API Platform), derrière la
 * session de l'admin (ADR 0001).
 * La forme est vérifiée ici, les règles par les cas d'usage.
 */
const LEGAL_PAGE_DONE: Record<string, string> = { modifie: 'Page légale modifiée.' }

const LEGAL_PAGE_HELP =
  'Chaque titre « ## » ouvre une section. Liens : [texte](https://…). Listes : une ligne par élément, commençant par « - ». Le HTML est affiché tel quel, sans être interprété.'

export const readLegalPageForm = (body: Record<string, unknown>): FormResult<LegalPage.Input> => {
  const values = { title: field(body, 'title'), body: field(body, 'body') }
  const errors: Errors = {}
  requiredText(errors, 'title', values.title)
  if (values.body === '') {
    errors.body = 'Cette valeur ne doit pas être vide.'
  }

  return { values, errors, data: Object.keys(errors).length === 0 ? values : null }
}

const legalPageListPage = (pages: readonly LegalPage.Editable[], message?: string) =>
  adminPage(
    'Pages légales',
    '/admin/pages-legales',
    html`<h1>Pages légales</h1>
      ${flash(message)}
      <table>
        <thead>
          <tr>
            <th scope="col">Titre</th>
            <th scope="col">Slug</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pages.map(
            (page) =>
              html`<tr>
                <td>${page.title}</td>
                <td>${page.slug}</td>
                <td>
                  <a href="/admin/pages-legales/${page.slug}/modifier"
                    >Modifier<span class="sr"> ${page.title}</span></a
                  >
                </td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

const legalPageFormPage = (
  title: string,
  action: string,
  values: Values,
  errors: Errors = {},
  error?: string,
) =>
  adminPage(
    title,
    '/admin/pages-legales',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" novalidate>
        ${textField('Titre', 'title', values, errors)}
        <p>${LEGAL_PAGE_HELP}</p>
        ${textareaField('Contenu (Markdown)', 'body', values, errors, 24)}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="/admin/pages-legales">Retour aux pages légales</a></p>`,
  )

const refusal = (error: unknown): string => {
  if (error instanceof ContentRuleViolation) {
    return error.message
  }
  throw error
}

export const adminContentRoutes = (dependencies: ContentAdminDependencies) => {
  const app = new Hono()
  app.get('/admin/pages-legales', async (c) => {
    const ok = c.req.query('ok')
    return c.html(
      legalPageListPage(
        await dependencies.legalPageWriter.findAll(),
        ok === undefined ? undefined : LEGAL_PAGE_DONE[ok],
      ),
    )
  })

  app.get('/admin/pages-legales/:slug/modifier', async (c) => {
    const page = await dependencies.legalPageWriter.findEditable(c.req.param('slug'))
    return page === null
      ? c.html(notFoundPage(), 404)
      : c.html(
          legalPageFormPage(`Modifier « ${page.title} »`, c.req.path, {
            title: page.title,
            body: page.body,
          }),
        )
  })

  app.post('/admin/pages-legales/:slug/modifier', async (c) => {
    const form = readLegalPageForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(
        legalPageFormPage('Modifier la page légale', c.req.path, form.values, form.errors),
        422,
      )
    }
    try {
      await updateLegalPage(dependencies, c.req.param('slug'), form.data)
    } catch (error) {
      return c.html(
        legalPageFormPage('Modifier la page légale', c.req.path, form.values, {}, refusal(error)),
        422,
      )
    }
    return c.redirect('/admin/pages-legales?ok=modifie', 303)
  })

  app.route('/', adminPageMetaRoutes(dependencies))

  return app
}
