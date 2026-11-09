import { Hono } from 'hono'
import { html } from 'hono/html'

import {
  checkbox,
  checkboxField,
  field,
  integer,
  maxLength,
  META_DESCRIPTION_MAX_LENGTH,
  META_TITLE_MAX_LENGTH,
  metaFieldsHtml,
  readMetaFields,
  requiredText,
  selectField,
  slugField,
  textareaField,
  textField,
} from '#/shared/http/adminForms.ts'
import { refusalMessage, t } from '#/shared/http/adminI18n.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'
import {
  inLocale,
  languageTabs,
  otherLocales,
  readTranslations,
  translationValues,
} from '#/shared/http/adminTranslations.ts'

import { SPEAKER_MAX_LENGTH } from '#/blog/domain/Article.ts'
import { createArticle, deleteArticle, updateArticle } from '#/blog/application/adminBlog.ts'
import {
  audioPreviewHtml,
  fileContent,
  imageCell,
  imageFieldsHtml,
  imagePreviewScript,
  imageValues,
  readImageFields,
} from '#/media/http/adminImageFields.ts'

import { adminArticleTermRoutes } from './adminArticleTerms.ts'

import type { BlogAdminDependencies } from '#/blog/application/adminBlog.ts'
import type { Article } from '#/blog/domain/Article.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'
import type { MessageKey } from '#/shared/http/adminI18n.ts'

/**
 * Admin des articles du blog (ADR 0001) : liste, création, modification, suppression, montées par
 * l'admin derrière sa session. La forme est vérifiée ici, les règles par les cas d'usage : la
 * rubrique, le format et le fichier audio (ADR 0009) comme l'image.
 */
const DONE: Readonly<Record<string, MessageKey>> = {
  cree: 'flash.article_created',
  modifie: 'flash.article_updated',
  supprime: 'flash.article_deleted',
}

/** Champs traduisibles d'un article (ADR 0014), dans l'ordre des onglets de langue. */
const ARTICLE_TRANSLATED = [
  'title',
  'slug',
  'excerpt',
  'body',
  'speaker',
  'imageAlt',
  'metaTitle',
  'metaDescription',
] as const

/** Longueurs maximales des champs traduits, celles des champs de la langue par défaut. */
const TRANSLATED_MAX_LENGTHS: Readonly<Record<string, number>> = {
  title: 255,
  speaker: SPEAKER_MAX_LENGTH,
  imageAlt: 255,
  metaTitle: META_TITLE_MAX_LENGTH,
  metaDescription: META_DESCRIPTION_MAX_LENGTH,
}

const isDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

const AUDIO_ACCEPT = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.m4a,.ogg'

/** Identifiant d'une rubrique ou d'un format choisi, null pour « Aucun ». */
const termChoice = (errors: Errors, name: string, value: string): number | null => {
  if (value === '') {
    return null
  }
  const id = integer(value)
  if (id === null) {
    errors[name] = t('validator.choice')
  }
  return id
}

export const readArticleForm = async (
  body: Record<string, unknown>,
): Promise<FormResult<Article.Input>> => {
  const title = field(body, 'title')
  const slug = field(body, 'slug')
  const excerpt = field(body, 'excerpt')
  const text = field(body, 'body')
  const publishedAt = field(body, 'publishedAt')
  const sectionId = field(body, 'sectionId')
  const formatId = field(body, 'formatId')
  const speaker = field(body, 'speaker')
  const removeAudio = checkbox(body, 'removeAudio')
  const values: Values = {
    title,
    slug,
    excerpt,
    body: text,
    publishedAt,
    sectionId,
    formatId,
    speaker,
    removeAudio,
  }
  const errors: Errors = {}
  requiredText(errors, 'title', title)
  slugField(errors, slug)
  if (!isDate(publishedAt)) {
    errors.publishedAt = t('validator.date')
  }
  const image = await readImageFields(body, values, errors)
  const section = termChoice(errors, 'sectionId', sectionId)
  const format = termChoice(errors, 'formatId', formatId)
  maxLength(errors, 'speaker', speaker, SPEAKER_MAX_LENGTH)
  const meta = readMetaFields(body, values, errors)
  const audioContent = await fileContent(body, 'audioContent')
  const translations = readTranslations(body, ARTICLE_TRANSLATED, values, errors)
  for (const locale of otherLocales()) {
    for (const [name, max] of Object.entries(TRANSLATED_MAX_LENGTHS)) {
      const key = inLocale(locale, name)
      maxLength(errors, key, values[key] ?? '', max)
    }
  }

  return {
    values,
    errors,
    data:
      Object.keys(errors).length === 0
        ? {
            title,
            slug,
            excerpt,
            publishedAt,
            imageContent: image.content,
            imageAlt: image.alt,
            imageDecorative: image.decorative,
            body: text,
            sectionId: section,
            formatId: format,
            audioContent,
            removeAudio: removeAudio === 'on',
            speaker,
            metaTitle: meta.title,
            metaDescription: meta.description,
            ...(translations === undefined ? {} : { translations }),
          }
        : null,
  }
}

const listPage = (articles: readonly Article.Entity[], message?: string, error?: string) =>
  adminPage(
    t('entity.articles'),
    '/admin/articles',
    html`<h1>${t('entity.articles')}</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/articles/nouveau">${t('title.new_article')}</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">${t('field.image')}</th>
            <th scope="col">${t('field.title')}</th>
            <th scope="col">${t('field.published_at')}</th>
            <th scope="col">${t('field.section')}</th>
            <th scope="col">${t('field.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${articles.map(
            (article) =>
              html`<tr>
                ${imageCell(article.image, 'article')}
                <td>${article.title}</td>
                <td>${article.publishedAt}</td>
                <td>${article.section?.name ?? '—'}</td>
                <td>
                  <a href="/admin/articles/${article.id}/modifier"
                    >${t('action.edit')}<span class="sr"> ${article.title}</span></a
                  >
                  ·
                  <a href="/admin/articles/${article.id}/supprimer"
                    >${t('action.delete')}<span class="sr"> ${article.title}</span></a
                  >
                </td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

/** Rubriques et formats proposés, et l'article enregistré (image et audio actuels) pour une modification. */
interface FormContext {
  readonly sections: readonly Article.Term[]
  readonly formats: readonly Article.Term[]
  readonly current: Article.Entity | null
}

const termOptions = (none: string, terms: readonly Article.Term[]) => [
  ['', none] as const,
  ...terms.map(({ id, name }) => [String(id), name] as const),
]

const formPage = (
  title: string,
  action: string,
  context: FormContext,
  values: Values,
  errors: Errors = {},
  error?: string,
) =>
  adminPage(
    title,
    '/admin/articles',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" enctype="multipart/form-data" novalidate>
        ${languageTabs('article', ARTICLE_TRANSLATED, errors, (locale) =>
          articleTexts(locale, values, errors),
        )}
        ${textField(t('field.published_at'), 'publishedAt', values, errors, 'date')}
        ${imageFieldsHtml(
          'article',
          t('help.article_alt'),
          values,
          errors,
          context.current?.image ?? null,
        )}
        ${selectField(
          t('field.section'),
          'sectionId',
          termOptions(t('article.no_section'), context.sections),
          values,
          errors,
        )}
        <p>${t('help.article_section')}</p>
        ${selectField(
          t('field.format'),
          'formatId',
          termOptions(t('article.no_format'), context.formats),
          values,
          errors,
        )}
        <p>${t('help.article_format')}</p>
        ${audioPreviewHtml(context.current?.audio ?? null)}
        <label for="audioContent">${t('field.audio')}</label>
        <input
          id="audioContent"
          name="audioContent"
          type="file"
          accept="${AUDIO_ACCEPT}"
          aria-describedby="aide-audioContent"
        />
        <p id="aide-audioContent">${t('help.audio')}</p>
        ${checkboxField(
          t('field.remove_audio'),
          'removeAudio',
          values,
          t('help.remove_ignores_upload'),
        )}
        <button type="submit">${t('form.save')}</button>
      </form>
      ${imagePreviewScript}
      <p><a href="/admin/articles">${t('article.back')}</a></p>`,
  )

/** Textes traduisibles d'un article dans une langue (null : la langue par défaut). */
const articleTexts = (locale: string | null, values: Values, errors: Errors) =>
  html`${textField(t('field.title'), inLocale(locale, 'title'), values, errors)}
    ${textField(t('field.slug'), inLocale(locale, 'slug'), values, errors)}
    ${locale === null ? '' : html`<p>${t('help.translated_slug')}</p>`}
    ${textareaField(t('field.excerpt'), inLocale(locale, 'excerpt'), values, errors)}
    ${textareaField(t('field.body'), inLocale(locale, 'body'), values, errors, 16)}
    <p>${t('help.article_body')}</p>
    ${textField(t('field.speaker'), inLocale(locale, 'speaker'), values, errors)}
    <p>${t('help.speaker', { max: SPEAKER_MAX_LENGTH })}</p>
    ${locale === null ? '' : textField(t('field.alt'), inLocale(locale, 'imageAlt'), values, errors)}
    ${metaFieldsHtml(values, errors, inLocale(locale, 'metaTitle'), inLocale(locale, 'metaDescription'))}`

const confirmPage = (article: Article.Entity, action: string) =>
  adminPage(
    t('title.delete', { name: article.title }),
    '/admin/articles',
    html`<h1>${t('title.delete', { name: article.title })}</h1>
      <p>${t('confirm.delete_article', { name: article.title })}</p>
      <form method="post" action="${action}">
        <button type="submit" class="danger">${t('action.delete')}</button>
      </form>
      <p><a href="/admin/articles">${t('form.cancel')}</a></p>`,
  )

const valuesOf = (article: Article.Entity): Values => ({
  title: article.title,
  slug: article.slug,
  excerpt: article.excerpt,
  body: article.body,
  publishedAt: article.publishedAt,
  ...imageValues(article.image),
  sectionId: article.section === null ? '' : String(article.section.id),
  formatId: article.format === null ? '' : String(article.format.id),
  speaker: article.speaker,
  removeAudio: '',
  metaTitle: article.metaTitle,
  metaDescription: article.metaDescription,
  ...translationValues(article.translations, ARTICLE_TRANSLATED),
})

const refusal = refusalMessage

const articleId = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null)

export const adminBlogRoutes = (dependencies: BlogAdminDependencies) => {
  const app = new Hono()
  const list = () => dependencies.articles.findLatestFirst()
  const find = async (value: string) => {
    const id = articleId(value)
    return id === null ? null : dependencies.articleWriter.findById(id)
  }
  const context = async (current: Article.Entity | null): Promise<FormContext> => ({
    sections: await dependencies.articleTerms.findByKind('section'),
    formats: await dependencies.articleTerms.findByKind('format'),
    current,
  })

  app.get('/admin/articles', async (c) => {
    const ok = c.req.query('ok')
    const done = ok === undefined ? undefined : DONE[ok]
    return c.html(listPage(await list(), done === undefined ? undefined : t(done)))
  })

  app.get('/admin/articles/nouveau', async (c) =>
    c.html(
      formPage(t('title.new_article'), c.req.path, await context(null), {
        publishedAt: new Date().toISOString().slice(0, 10),
      }),
    ),
  )

  app.post('/admin/articles/nouveau', async (c) => {
    const form = await readArticleForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(
        formPage(t('title.new_article'), c.req.path, await context(null), form.values, form.errors),
        422,
      )
    }
    try {
      await createArticle(dependencies, form.data)
    } catch (error) {
      return c.html(
        formPage(
          t('title.new_article'),
          c.req.path,
          await context(null),
          form.values,
          {},
          refusal(error),
        ),
        422,
      )
    }
    return c.redirect('/admin/articles?ok=cree', 303)
  })

  app.get('/admin/articles/:id/modifier', async (c) => {
    const article = await find(c.req.param('id'))
    return article === null
      ? c.html(notFoundPage(), 404)
      : c.html(
          formPage(
            t('title.edit', { name: article.title }),
            c.req.path,
            await context(article),
            valuesOf(article),
          ),
        )
  })

  app.post('/admin/articles/:id/modifier', async (c) => {
    const id = articleId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    const form = await readArticleForm(await c.req.parseBody())
    const current = async () => context(await dependencies.articleWriter.findById(id))
    if (form.data === null) {
      return c.html(
        formPage(t('title.edit_article'), c.req.path, await current(), form.values, form.errors),
        422,
      )
    }
    try {
      await updateArticle(dependencies, id, form.data)
    } catch (error) {
      return c.html(
        formPage(
          t('title.edit_article'),
          c.req.path,
          await current(),
          form.values,
          {},
          refusal(error),
        ),
        422,
      )
    }
    return c.redirect('/admin/articles?ok=modifie', 303)
  })

  app.get('/admin/articles/:id/supprimer', async (c) => {
    const article = await find(c.req.param('id'))
    return article === null ? c.html(notFoundPage(), 404) : c.html(confirmPage(article, c.req.path))
  })

  app.post('/admin/articles/:id/supprimer', async (c) => {
    const id = articleId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    try {
      await deleteArticle(dependencies, id)
    } catch (error) {
      return c.html(listPage(await list(), undefined, refusal(error)), 422)
    }
    return c.redirect('/admin/articles?ok=supprime', 303)
  })

  app.route('/', adminArticleTermRoutes(dependencies, 'section'))
  app.route('/', adminArticleTermRoutes(dependencies, 'format'))

  return app
}
