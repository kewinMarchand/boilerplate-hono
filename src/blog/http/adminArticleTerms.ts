import { Hono } from 'hono'
import { html } from 'hono/html'

import { field, integer, maxLength, textField } from '#/shared/http/adminForms.ts'
import { refusalMessage, t } from '#/shared/http/adminI18n.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'
import {
  inLocale,
  languageTabs,
  otherLocales,
  readTranslations,
  translationValues,
} from '#/shared/http/adminTranslations.ts'

import {
  createArticleTerm,
  deleteArticleTerm,
  updateArticleTerm,
} from '#/blog/application/adminBlog.ts'

import type { BlogAdminDependencies } from '#/blog/application/adminBlog.ts'
import type { Article } from '#/blog/domain/Article.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'
import type { MessageKey } from '#/shared/http/adminI18n.ts'

/**
 * Rubriques et formats des articles (ADR 0009) : deux sections de l'admin, une par liste, mêmes
 * pages et mêmes cas d'usage, la sorte en paramètre (ArticleTermCrudController de l'API Platform).
 * Forme vérifiée ici avec les contraintes d'ArticleTermType.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,59}$/
const NAME_MAX_LENGTH = 60

/** Champs traduisibles d'une rubrique ou d'un format (ADR 0014). */
const TERM_TRANSLATED = ['name', 'slug'] as const

/** Clés des libellés propres à chaque liste, accordés à la sorte. */
interface Wording {
  readonly path: string
  readonly plural: MessageKey
  readonly created: MessageKey
  readonly modified: MessageKey
  readonly deleted: MessageKey
  readonly newTitle: MessageKey
  readonly editTitle: MessageKey
  readonly back: MessageKey
  /** Paramètre `%name%`. */
  readonly deleteQuestion: MessageKey
}

const WORDING: Record<Article.TermKind, Wording> = {
  section: {
    path: '/admin/rubriques',
    plural: 'entity.sections',
    created: 'flash.section_created',
    modified: 'flash.section_updated',
    deleted: 'flash.section_deleted',
    newTitle: 'title.new_section',
    editTitle: 'title.edit_section',
    back: 'section.back',
    deleteQuestion: 'confirm.delete_section',
  },
  format: {
    path: '/admin/formats',
    plural: 'entity.formats',
    created: 'flash.format_created',
    modified: 'flash.format_updated',
    deleted: 'flash.format_deleted',
    newTitle: 'title.new_format',
    editTitle: 'title.edit_format',
    back: 'format.back',
    deleteQuestion: 'confirm.delete_format',
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
    errors.name = t('validator.not_blank')
  }
  maxLength(errors, 'name', values.name ?? '', NAME_MAX_LENGTH)
  if (values.slug === '') {
    errors.slug = t('validator.not_blank')
  } else if (!SLUG_PATTERN.test(values.slug ?? '')) {
    errors.slug = t('constraint.term_slug')
  }
  const position = integer(values.position ?? '')
  if ((values.position ?? '') === '') {
    errors.position = t('validator.not_blank')
  } else if (position === null) {
    errors.position = t('validator.integer')
  } else if (position < 0) {
    errors.position = t('validator.positive_or_zero')
  }
  const translations = readTranslations(body, TERM_TRANSLATED, values, errors)
  for (const locale of otherLocales()) {
    const name = inLocale(locale, 'name')
    const slug = inLocale(locale, 'slug')
    maxLength(errors, name, values[name] ?? '', NAME_MAX_LENGTH)
    if ((values[slug] ?? '') !== '' && !SLUG_PATTERN.test(values[slug] ?? '')) {
      errors[slug] = t('constraint.term_slug')
    }
  }
  const data =
    Object.keys(errors).length === 0 && position !== null
      ? {
          name: values.name ?? '',
          slug: values.slug ?? '',
          position,
          ...(translations === undefined ? {} : { translations }),
        }
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
    t(wording.plural),
    wording.path,
    html`<h1>${t(wording.plural)}</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="${wording.path}/nouveau">${t(wording.newTitle)}</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">${t('field.name')}</th>
            <th scope="col">${t('field.slug')}</th>
            <th scope="col">${t('field.position')}</th>
            <th scope="col">${t('field.actions')}</th>
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
                    >${t('action.edit')}<span class="sr"> ${term.name}</span></a
                  >
                  ·
                  <a href="${wording.path}/${term.id}/supprimer"
                    >${t('action.delete')}<span class="sr"> ${term.name}</span></a
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
        ${languageTabs(
          'terme',
          TERM_TRANSLATED,
          errors,
          (locale) =>
            html`${textField(t('field.name'), inLocale(locale, 'name'), values, errors)}
              ${textField(t('field.slug'), inLocale(locale, 'slug'), values, errors)}
              <p>${locale === null ? t('help.term_slug') : t('help.translated_slug')}</p>`,
        )}
        ${textField(t('field.position'), 'position', values, errors, 'number')}
        <button type="submit">${t('form.save')}</button>
      </form>
      <p><a href="${wording.path}">${t(wording.back)}</a></p>`,
  )

const confirmPage = (wording: Wording, term: Article.Term, action: string) =>
  adminPage(
    t('title.delete', { name: term.name }),
    wording.path,
    html`<h1>${t('title.delete', { name: term.name })}</h1>
      <p>${t(wording.deleteQuestion, { name: term.name })}</p>
      <form method="post" action="${action}">
        <button type="submit" class="danger">${t('action.delete')}</button>
      </form>
      <p><a href="${wording.path}">${t('form.cancel')}</a></p>`,
  )

const refusal = refusalMessage

const termId = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null)

export const adminArticleTermRoutes = (
  dependencies: BlogAdminDependencies,
  kind: Article.TermKind,
) => {
  const app = new Hono()
  const wording = WORDING[kind]
  const done: Readonly<Record<string, MessageKey>> = {
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
    const message = ok === undefined ? undefined : done[ok]
    return c.html(listPage(wording, await list(), message === undefined ? undefined : t(message)))
  })

  app.get(`${wording.path}/nouveau`, (c) =>
    c.html(formPage(wording, t(wording.newTitle), c.req.path, { position: '0' })),
  )

  app.post(`${wording.path}/nouveau`, async (c) => {
    const form = readArticleTermForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(
        formPage(wording, t(wording.newTitle), c.req.path, form.values, form.errors),
        422,
      )
    }
    try {
      await createArticleTerm(dependencies, kind, form.data)
    } catch (error) {
      return c.html(
        formPage(wording, t(wording.newTitle), c.req.path, form.values, {}, refusal(error)),
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
          formPage(wording, t('title.edit', { name: term.name }), c.req.path, {
            name: term.name,
            slug: term.slug,
            position: String(term.position),
            ...translationValues(term.translations, TERM_TRANSLATED),
          }),
        )
  })

  app.post(`${wording.path}/:id/modifier`, async (c) => {
    const id = termId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    const title = t(wording.editTitle)
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
