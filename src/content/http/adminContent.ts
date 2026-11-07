import { Hono } from 'hono'
import { html } from 'hono/html'

import {
  field,
  integer,
  requiredText,
  slugField,
  textareaField,
  textField,
} from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError, notFoundPage } from '#/shared/http/adminLayout.ts'

import { ContentRuleViolation } from '#/content/domain/contentRules.ts'
import { MediaRuleViolation } from '#/media/domain/imageRules.ts'
import {
  createSlide,
  deleteSlide,
  updateLegalPage,
  updateSlide,
} from '#/content/application/adminContent.ts'
import {
  imageCell,
  imageFieldsHtml,
  imageValues,
  readImageFields,
} from '#/media/http/adminImageFields.ts'

import type { ContentAdminDependencies } from '#/content/application/adminContent.ts'
import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Slide } from '#/content/domain/Slide.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { Errors, FormResult, Values } from '#/shared/http/adminForms.ts'

/**
 * Admin du carrousel (liste, création, modification, suppression) et des pages légales (liste,
 * modification seulement, comme l'API Platform), derrière la session de l'admin (ADR 0001).
 * La forme est vérifiée ici, les règles par les cas d'usage.
 */
const SLIDE_DONE: Record<string, string> = {
  cree: 'Diapositive créée.',
  modifie: 'Diapositive modifiée.',
  supprime: 'Diapositive supprimée.',
}

const LEGAL_PAGE_DONE: Record<string, string> = { modifie: 'Page légale modifiée.' }

const LEGAL_PAGE_HELP =
  'Chaque titre « ## » ouvre une section. Liens : [texte](https://…). Listes : une ligne par élément, commençant par « - ». Le HTML est affiché tel quel, sans être interprété.'

const SLIDE_ALT_HELP =
  'Ce que montre la photo, pour qui ne la voit pas. Le titre de la diapositive est déjà lu à côté.'

export const readSlideForm = async (
  body: Record<string, unknown>,
): Promise<FormResult<Slide.Input>> => {
  const title = field(body, 'title')
  const slug = field(body, 'slug')
  const text = field(body, 'text')
  const values: Values = { title, slug, text, position: field(body, 'position') }
  const errors: Errors = {}
  requiredText(errors, 'title', title)
  slugField(errors, slug)
  const image = await readImageFields(body, values, errors)
  const position = integer(field(body, 'position'))
  if (position === null) {
    errors.position = 'Cette valeur doit être un nombre entier.'
  }
  return {
    values,
    errors,
    data:
      Object.keys(errors).length === 0 && position !== null
        ? {
            title,
            slug,
            text,
            position,
            imageContent: image.content,
            imageAlt: image.alt,
            imageDecorative: image.decorative,
          }
        : null,
  }
}

export const readLegalPageForm = (body: Record<string, unknown>): FormResult<LegalPage.Input> => {
  const values = { title: field(body, 'title'), body: field(body, 'body') }
  const errors: Errors = {}
  requiredText(errors, 'title', values.title)
  if (values.body === '') {
    errors.body = 'Cette valeur ne doit pas être vide.'
  }

  return { values, errors, data: Object.keys(errors).length === 0 ? values : null }
}

const slideListPage = (slides: readonly Slide.Editable[], message?: string, error?: string) =>
  adminPage(
    'Carrousel',
    '/admin/carrousel',
    html`<h1>Carrousel</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/carrousel/nouveau">Nouvelle diapositive</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">Image</th>
            <th scope="col">Position</th>
            <th scope="col">Titre</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${slides.map(
            (slide) =>
              html`<tr>
                ${imageCell(slide.image, 'slide')}
                <td>${slide.position}</td>
                <td>${slide.title}</td>
                <td>
                  <a href="/admin/carrousel/${slide.id}/modifier"
                    >Modifier<span class="sr"> ${slide.title}</span></a
                  >
                  ·
                  <a href="/admin/carrousel/${slide.id}/supprimer"
                    >Supprimer<span class="sr"> ${slide.title}</span></a
                  >
                </td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

const slideFormPage = (
  title: string,
  action: string,
  values: Values,
  errors: Errors = {},
  error?: string,
  image: Media.Image | null = null,
) =>
  adminPage(
    title,
    '/admin/carrousel',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" enctype="multipart/form-data" novalidate>
        ${textField('Titre', 'title', values, errors)} ${textField('Slug', 'slug', values, errors)}
        ${textareaField('Texte', 'text', values, errors)}
        ${textField('Position (ordre croissant)', 'position', values, errors, 'number')}
        ${imageFieldsHtml('slide', SLIDE_ALT_HELP, values, errors, image)}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="/admin/carrousel">Retour au carrousel</a></p>`,
  )

const slideConfirmPage = (slide: Slide.Editable, action: string) =>
  adminPage(
    `Supprimer « ${slide.title} »`,
    '/admin/carrousel',
    html`<h1>Supprimer « ${slide.title} »</h1>
      <p>La diapositive « ${slide.title} » sera retirée du carrousel.</p>
      <form method="post" action="${action}">
        <button type="submit" class="danger">Supprimer</button>
      </form>
      <p><a href="/admin/carrousel">Annuler</a></p>`,
  )

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

const slideValues = ({ title, slug, text, image, position }: Slide.Editable): Values => ({
  title,
  slug,
  text,
  position: String(position),
  ...imageValues(image),
})

const refusal = (error: unknown): string => {
  if (error instanceof ContentRuleViolation || error instanceof MediaRuleViolation) {
    return error.message
  }
  throw error
}

const slideId = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null)

export const adminContentRoutes = (dependencies: ContentAdminDependencies) => {
  const app = new Hono()
  const slides = () => dependencies.slideWriter.findAll()
  const findSlide = async (value: string) => {
    const id = slideId(value)
    return id === null ? null : dependencies.slideWriter.findById(id)
  }

  app.get('/admin/carrousel', async (c) => {
    const ok = c.req.query('ok')
    return c.html(slideListPage(await slides(), ok === undefined ? undefined : SLIDE_DONE[ok]))
  })

  app.get('/admin/carrousel/nouveau', (c) =>
    c.html(slideFormPage('Nouvelle diapositive', c.req.path, { position: '1' })),
  )

  app.post('/admin/carrousel/nouveau', async (c) => {
    const form = await readSlideForm(await c.req.parseBody())
    if (form.data === null) {
      return c.html(
        slideFormPage('Nouvelle diapositive', c.req.path, form.values, form.errors),
        422,
      )
    }
    try {
      await createSlide(dependencies, form.data)
    } catch (error) {
      return c.html(
        slideFormPage('Nouvelle diapositive', c.req.path, form.values, {}, refusal(error)),
        422,
      )
    }
    return c.redirect('/admin/carrousel?ok=cree', 303)
  })

  app.get('/admin/carrousel/:id/modifier', async (c) => {
    const slide = await findSlide(c.req.param('id'))
    return slide === null
      ? c.html(notFoundPage(), 404)
      : c.html(
          slideFormPage(
            `Modifier « ${slide.title} »`,
            c.req.path,
            slideValues(slide),
            {},
            undefined,
            slide.image,
          ),
        )
  })

  app.post('/admin/carrousel/:id/modifier', async (c) => {
    const id = slideId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    const form = await readSlideForm(await c.req.parseBody())
    const title = 'Modifier la diapositive'
    const image = async () => (await dependencies.slideWriter.findById(id))?.image ?? null
    if (form.data === null) {
      return c.html(
        slideFormPage(title, c.req.path, form.values, form.errors, undefined, await image()),
        422,
      )
    }
    try {
      await updateSlide(dependencies, id, form.data)
    } catch (error) {
      return c.html(
        slideFormPage(title, c.req.path, form.values, {}, refusal(error), await image()),
        422,
      )
    }
    return c.redirect('/admin/carrousel?ok=modifie', 303)
  })

  app.get('/admin/carrousel/:id/supprimer', async (c) => {
    const slide = await findSlide(c.req.param('id'))
    return slide === null
      ? c.html(notFoundPage(), 404)
      : c.html(slideConfirmPage(slide, c.req.path))
  })

  app.post('/admin/carrousel/:id/supprimer', async (c) => {
    const id = slideId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    try {
      await deleteSlide(dependencies, id)
    } catch (error) {
      return c.html(slideListPage(await slides(), undefined, refusal(error)), 422)
    }
    return c.redirect('/admin/carrousel?ok=supprime', 303)
  })

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

  return app
}
