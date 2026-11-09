import { Hono } from 'hono'
import { html } from 'hono/html'

import { metaFieldsHtml, readMetaFields } from '#/shared/http/adminForms.ts'
import { refusalMessage, t } from '#/shared/http/adminI18n.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'
import {
  inLocale,
  languageTabs,
  otherLocales,
  readTranslations,
  translationValues,
} from '#/shared/http/adminTranslations.ts'

import { isMetaPage, META_PAGES } from '#/content/domain/PageMeta.ts'
import { updatePageMeta } from '#/content/application/adminContent.ts'

import type { ContentAdminDependencies } from '#/content/application/adminContent.ts'
import type { PageMeta } from '#/content/domain/PageMeta.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

/**
 * Référencement des pages fixes (ADR 0010) : une fiche par page, en modification seule, comme
 * PageMetaCrudController de l'API Platform. Longueurs vérifiées ici (60 et 160 caractères).
 */
const PATH = '/admin/referencement'

/** Champs traduisibles du référencement d'une page fixe (ADR 0014). */
const PAGE_META_TRANSLATED = ['title', 'description'] as const

/** Nom d'une page fixe dans la langue de l'interface. */
const pageLabel = (page: PageMeta.Page): string => t(`meta_page.${page}`)

export const readPageMetaForm = (body: Record<string, unknown>): FormResult<PageMeta.Input> => {
  const values: Values = {}
  const errors: Errors = {}
  const { title, description } = readMetaFields(body, values, errors, 'title', 'description')
  for (const locale of otherLocales()) {
    readMetaFields(body, values, errors, inLocale(locale, 'title'), inLocale(locale, 'description'))
  }
  const translations = readTranslations(body, PAGE_META_TRANSLATED, values, errors)

  return {
    values,
    errors,
    data:
      Object.keys(errors).length === 0
        ? { title, description, ...(translations === undefined ? {} : { translations }) }
        : null,
  }
}

const listPage = (metas: readonly PageMeta.Entity[], message?: string) => {
  const saved = new Map(metas.map((meta) => [meta.page, meta]))
  return adminPage(
    t('entity.page_metas'),
    PATH,
    html`<h1>${t('entity.page_metas')}</h1>
      ${flash(message)}
      <p>${t('help.page_metas')}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">${t('field.page')}</th>
            <th scope="col">${t('field.title')}</th>
            <th scope="col">${t('field.description')}</th>
            <th scope="col">${t('field.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${META_PAGES.map(
            (page) =>
              html`<tr>
                <td>${pageLabel(page)}</td>
                <td>${saved.get(page)?.title ?? ''}</td>
                <td>${saved.get(page)?.description ?? ''}</td>
                <td>
                  <a href="${PATH}/${page}/modifier"
                    >${t('action.edit')}<span class="sr"> ${pageLabel(page)}</span></a
                  >
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
  const title = t('title.page_meta', { name: pageLabel(page) })
  return adminPage(
    title,
    PATH,
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" novalidate>
        ${languageTabs('referencement', PAGE_META_TRANSLATED, errors, (locale) =>
          metaFieldsHtml(
            values,
            errors,
            inLocale(locale, 'title'),
            inLocale(locale, 'description'),
          ),
        )}
        <button type="submit">${t('form.save')}</button>
      </form>
      <p><a href="${PATH}">${t('page_meta.back')}</a></p>`,
  )
}

const refusal = refusalMessage

export const adminPageMetaRoutes = (dependencies: ContentAdminDependencies) => {
  const app = new Hono()

  app.get(PATH, async (c) => {
    const ok = c.req.query('ok')
    const metas = await dependencies.pageMetaWriter.findAll()
    return c.html(listPage(metas, ok === 'modifie' ? t('flash.page_meta_saved') : undefined))
  })

  app.get(`${PATH}/:page/modifier`, async (c) => {
    const page = c.req.param('page')
    const meta = isMetaPage(page) ? await dependencies.pageMetaWriter.find(page) : null
    return meta === null
      ? c.html(notFoundPage(), 404)
      : c.html(
          formPage(meta.page, c.req.path, {
            title: meta.title,
            description: meta.description,
            ...translationValues(meta.translations, PAGE_META_TRANSLATED),
          }),
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
