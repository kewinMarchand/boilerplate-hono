import { Hono } from 'hono'
import { html } from 'hono/html'

import {
  checkbox,
  checkboxField,
  field,
  integer,
  maxLength,
  metaFieldsHtml,
  readMetaFields,
  requiredText,
  selectField,
  slugField,
  textareaField,
  textField,
} from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'

import { BlogRuleViolation, SPEAKER_MAX_LENGTH } from '#/blog/domain/Article.ts'
import { MediaRuleViolation } from '#/media/domain/imageRules.ts'
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

/**
 * Admin des articles du blog (ADR 0001) : liste, création, modification, suppression, montées par
 * l'admin derrière sa session. La forme est vérifiée ici, les règles par les cas d'usage : la
 * rubrique, le format et le fichier audio (ADR 0009) comme l'image.
 */
const DONE: Record<string, string> = {
  cree: 'Article créé.',
  modifie: 'Article modifié.',
  supprime: 'Article supprimé.',
}

const isDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

const ALT_HELP =
  "Ce que montre l'image, si elle apporte une information. Une illustration d'ambiance est décorative."

const AUDIO_ACCEPT = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.m4a,.ogg'

/** Identifiant d'une rubrique ou d'un format choisi, null pour « Aucun ». */
const termChoice = (errors: Errors, name: string, value: string): number | null => {
  if (value === '') {
    return null
  }
  const id = integer(value)
  if (id === null) {
    errors[name] = 'Le choix sélectionné est invalide.'
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
    errors.publishedAt = 'Veuillez entrer une date valide.'
  }
  const image = await readImageFields(body, values, errors)
  const section = termChoice(errors, 'sectionId', sectionId)
  const format = termChoice(errors, 'formatId', formatId)
  maxLength(errors, 'speaker', speaker, SPEAKER_MAX_LENGTH)
  const meta = readMetaFields(body, values, errors)
  const audioContent = await fileContent(body, 'audioContent')

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
          }
        : null,
  }
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
            <th scope="col">Image</th>
            <th scope="col">Titre</th>
            <th scope="col">Publié le</th>
            <th scope="col">Rubrique</th>
            <th scope="col">Actions</th>
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
        ${textField('Titre', 'title', values, errors)} ${textField('Slug', 'slug', values, errors)}
        ${textareaField('Résumé', 'excerpt', values, errors)}
        ${textareaField('Texte', 'body', values, errors, 16)}
        <p>
          Markdown : paragraphes séparés par une ligne vide, ## pour un intertitre, - pour une
          liste, [texte](adresse) pour un lien. Le HTML saisi est affiché tel quel, sans être
          interprété.
        </p>
        ${textField('Date de publication', 'publishedAt', values, errors, 'date')}
        ${imageFieldsHtml('article', ALT_HELP, values, errors, context.current?.image ?? null)}
        ${selectField('Rubrique', 'sectionId', termOptions('Aucune', context.sections), values, errors)}
        <p>Liste de la section « Rubriques ».</p>
        ${selectField('Format', 'formatId', termOptions('Aucun', context.formats), values, errors)}
        <p>Liste de la section « Formats ».</p>
        ${audioPreviewHtml(context.current?.audio ?? null)}
        <label for="audioContent">Fichier audio</label>
        <input
          id="audioContent"
          name="audioContent"
          type="file"
          accept="${AUDIO_ACCEPT}"
          aria-describedby="aide-audioContent"
        />
        <p id="aide-audioContent">
          MP3, M4A ou OGG, 100 Mo au plus. La durée est lue dans le fichier. Sans fichier, l'audio
          actuel est gardé.
        </p>
        ${checkboxField(
          'Retirer le fichier audio',
          'removeAudio',
          values,
          'Un fichier envoyé en même temps est ignoré.',
        )}
        ${textField('Intervenant', 'speaker', values, errors)}
        <p>Affiché avec le lecteur audio, ${SPEAKER_MAX_LENGTH} caractères au plus.</p>
        ${metaFieldsHtml(values, errors)}
        <button type="submit">Enregistrer</button>
      </form>
      ${imagePreviewScript}
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
})

const refusal = (error: unknown): string => {
  if (error instanceof BlogRuleViolation || error instanceof MediaRuleViolation) {
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
  const context = async (current: Article.Entity | null): Promise<FormContext> => ({
    sections: await dependencies.articleTerms.findByKind('section'),
    formats: await dependencies.articleTerms.findByKind('format'),
    current,
  })

  app.get('/admin/articles', async (c) => {
    const ok = c.req.query('ok')
    return c.html(listPage(await list(), ok === undefined ? undefined : DONE[ok]))
  })

  app.get('/admin/articles/nouveau', async (c) =>
    c.html(
      formPage('Nouvel article', c.req.path, await context(null), {
        publishedAt: new Date().toISOString().slice(0, 10),
      }),
    ),
  )

  app.post('/admin/articles/nouveau', async (c) => {
    const form = await readArticleForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(
        formPage('Nouvel article', c.req.path, await context(null), form.values, form.errors),
        422,
      )
    }
    try {
      await createArticle(dependencies, form.data)
    } catch (error) {
      return c.html(
        formPage(
          'Nouvel article',
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
            `Modifier « ${article.title} »`,
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
        formPage("Modifier l'article", c.req.path, await current(), form.values, form.errors),
        422,
      )
    }
    try {
      await updateArticle(dependencies, id, form.data)
    } catch (error) {
      return c.html(
        formPage(
          "Modifier l'article",
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
