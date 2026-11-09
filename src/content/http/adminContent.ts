import { Hono } from 'hono'
import { html } from 'hono/html'

import { field, requiredText, textareaField, textField } from '#/shared/http/adminForms.ts'
import { refusalMessage, t } from '#/shared/http/adminI18n.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'
import {
  inLocale,
  languageTabs,
  otherLocales,
  readTranslations,
  translationValues,
} from '#/shared/http/adminTranslations.ts'

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
/** Champs traduisibles d'une page légale (ADR 0014) ; le slug, fixé par les routes des fronts, est commun aux langues. */
const LEGAL_PAGE_TRANSLATED = ['title', 'body'] as const

export const readLegalPageForm = (body: Record<string, unknown>): FormResult<LegalPage.Input> => {
  const title = field(body, 'title')
  const text = field(body, 'body')
  const values: Values = { title, body: text }
  const errors: Errors = {}
  requiredText(errors, 'title', title)
  if (text === '') {
    errors.body = t('validator.not_blank')
  }
  const translations = readTranslations(body, LEGAL_PAGE_TRANSLATED, values, errors)
  for (const locale of otherLocales()) {
    const key = inLocale(locale, 'title')
    if (Array.from(values[key] ?? '').length > 255) {
      errors[key] = t('validator.too_long', { max: 255 })
    }
  }

  return {
    values,
    errors,
    data:
      Object.keys(errors).length === 0
        ? { title, body: text, ...(translations === undefined ? {} : { translations }) }
        : null,
  }
}

const legalPageListPage = (pages: readonly LegalPage.Editable[], message?: string) =>
  adminPage(
    t('entity.legal_pages'),
    '/admin/pages-legales',
    html`<h1>${t('entity.legal_pages')}</h1>
      ${flash(message)}
      <table>
        <thead>
          <tr>
            <th scope="col">${t('field.title')}</th>
            <th scope="col">${t('field.slug')}</th>
            <th scope="col">${t('field.actions')}</th>
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
                    >${t('action.edit')}<span class="sr"> ${page.title}</span></a
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
        ${languageTabs(
          'page',
          LEGAL_PAGE_TRANSLATED,
          errors,
          (locale) =>
            html`${textField(t('field.title'), inLocale(locale, 'title'), values, errors)}
              <p>${t('help.legal_body')}</p>
              ${textareaField(t('field.markdown_body'), inLocale(locale, 'body'), values, errors, 24)}`,
        )}
        <button type="submit">${t('form.save')}</button>
      </form>
      <p><a href="/admin/pages-legales">${t('legal_page.back')}</a></p>`,
  )

const refusal = refusalMessage

export const adminContentRoutes = (dependencies: ContentAdminDependencies) => {
  const app = new Hono()
  app.get('/admin/pages-legales', async (c) => {
    const ok = c.req.query('ok')
    return c.html(
      legalPageListPage(
        await dependencies.legalPageWriter.findAll(),
        ok === 'modifie' ? t('flash.legal_page_updated') : undefined,
      ),
    )
  })

  app.get('/admin/pages-legales/:slug/modifier', async (c) => {
    const page = await dependencies.legalPageWriter.findEditable(c.req.param('slug'))
    return page === null
      ? c.html(notFoundPage(), 404)
      : c.html(
          legalPageFormPage(t('title.edit', { name: page.title }), c.req.path, {
            title: page.title,
            body: page.body,
            ...translationValues(page.translations, LEGAL_PAGE_TRANSLATED),
          }),
        )
  })

  app.post('/admin/pages-legales/:slug/modifier', async (c) => {
    const form = readLegalPageForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(
        legalPageFormPage(t('title.edit_legal_page'), c.req.path, form.values, form.errors),
        422,
      )
    }
    try {
      await updateLegalPage(dependencies, c.req.param('slug'), form.data)
    } catch (error) {
      return c.html(
        legalPageFormPage(t('title.edit_legal_page'), c.req.path, form.values, {}, refusal(error)),
        422,
      )
    }
    return c.redirect('/admin/pages-legales?ok=modifie', 303)
  })

  app.route('/', adminPageMetaRoutes(dependencies))

  return app
}
