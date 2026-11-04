import { describe, expect, it } from 'vitest'

import { ContentRuleViolation } from '#/content/domain/contentRules.ts'
import {
  createSlide,
  deleteSlide,
  updateLegalPage,
  updateSlide,
} from '#/content/application/adminContent.ts'
import { readLegalPageForm, readSlideForm } from '#/content/http/adminContent.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Slide } from '#/content/domain/Slide.ts'

const content = () => {
  let slides: Slide.Editable[] = [
    { id: 1, slug: 'heliconia', title: 'Heliconia', text: '', image: 1, position: 1 },
  ]
  let pages: (LegalPage.Editable & { introduction: string })[] = [
    { slug: 'mentions-legales', title: 'Mentions légales', body: 'Avant.', introduction: '' },
  ]
  const dependencies = {
    slideWriter: {
      findAll: () => Promise.resolve(slides),
      findById: (id: number) => Promise.resolve(slides.find((s) => s.id === id) ?? null),
      findBySlug: (slug: string) => Promise.resolve(slides.find((s) => s.slug === slug) ?? null),
      create: (input: Slide.Input) => {
        const slide = { id: slides.length + 1, ...input }
        slides = [...slides, slide]
        return Promise.resolve(slide)
      },
      update: (id: number, input: Slide.Input) => {
        slides = slides.map((s) => (s.id === id ? { id, ...input } : s))
        return Promise.resolve()
      },
      remove: (id: number) => {
        slides = slides.filter((s) => s.id !== id)
        return Promise.resolve()
      },
    },
    legalPageWriter: {
      findAll: () => Promise.resolve(pages),
      findEditable: (slug: string) => Promise.resolve(pages.find((p) => p.slug === slug) ?? null),
      update: (slug: string, page: LegalPage.Input & { introduction: string }) => {
        pages = pages.map((p) => (p.slug === slug ? { slug, ...page } : p))
        return Promise.resolve()
      },
    },
    legalPageRenderer: {
      split: (body: string) => ({ introduction: `<p>${body}</p>`, sections: [] }),
    },
  }
  return { dependencies, slides: () => slides, pages: () => pages }
}

const slide = (slug: string, image = 2): Slide.Input => ({
  slug,
  title: 'Titre',
  text: '',
  image,
  position: 2,
})

describe('Admin : contenus', () => {
  it('refuse un slug déjà pris par une autre diapositive, accepte le sien', async () => {
    const { dependencies } = content()

    await expect(createSlide(dependencies, slide('heliconia'))).rejects.toThrow(
      new ContentRuleViolation('Le slug « heliconia » est déjà pris par une autre diapositive.'),
    )
    await expect(updateSlide(dependencies, 1, slide('heliconia'))).resolves.toBeUndefined()
  })

  it('refuse un visuel hors des 5 livrés avec les fronts', async () => {
    const { dependencies } = content()

    await expect(createSlide(dependencies, slide('anthurium', 6))).rejects.toThrow(
      'Le visuel est un numéro de 1 à 5 : 6.',
    )
  })

  it('refuse de modifier ou supprimer une diapositive disparue', async () => {
    const { dependencies } = content()

    await expect(updateSlide(dependencies, 9, slide('autre'))).rejects.toThrow(
      "Cette diapositive n'existe plus.",
    )
    await expect(deleteSlide(dependencies, 9)).rejects.toThrow("Cette diapositive n'existe plus.")
  })

  it('crée puis supprime une diapositive', async () => {
    const { dependencies, slides } = content()

    const created = await createSlide(dependencies, slide('anthurium'))
    await deleteSlide(dependencies, created.id)

    expect(slides().map((s) => s.slug)).toEqual(['heliconia'])
  })

  it('enregistre le Markdown d’une page légale avec son rendu', async () => {
    const { dependencies, pages } = content()

    await updateLegalPage(dependencies, 'mentions-legales', { title: 'Mentions', body: 'Après.' })

    expect(pages()[0]).toMatchObject({
      title: 'Mentions',
      body: 'Après.',
      introduction: '<p>Après.</p>',
    })
    await expect(updateLegalPage(dependencies, 'cgv', { title: 'CGV', body: 'x' })).rejects.toThrow(
      "Cette page n'existe plus.",
    )
  })

  it('vérifie la forme des saisies', () => {
    const slideForm = readSlideForm({ title: '', slug: 'Pas Un Slug', image: '0', position: 'x' })
    expect(slideForm.data).toBeNull()
    expect(slideForm.errors).toEqual({
      title: 'Cette valeur ne doit pas être vide.',
      slug: 'Minuscules, chiffres et tirets seulement.',
      image: 'Cette valeur doit être comprise entre 1 et 5.',
      position: 'Cette valeur doit être un nombre entier.',
    })

    const pageForm = readLegalPageForm({ title: 'Mentions', body: '   ' })
    expect(pageForm.errors).toEqual({ body: 'Cette valeur ne doit pas être vide.' })
  })
})
