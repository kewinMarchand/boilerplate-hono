import { describe, expect, it } from 'vitest'

import { ContentRuleViolation } from '#/content/domain/contentRules.ts'
import {
  createSlide,
  deleteSlide,
  updateLegalPage,
  updateSlide,
} from '#/content/application/adminContent.ts'
import { readLegalPageForm, readSlideForm } from '#/content/http/adminContent.ts'

import { fakeMedia, PHOTO, testImage } from './fakeMedia.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Slide } from '#/content/domain/Slide.ts'

const content = () => {
  let slides: Slide.Editable[] = [
    {
      id: 1,
      slug: 'heliconia',
      title: 'Heliconia',
      text: '',
      image: testImage('Heliconia'),
      position: 1,
    },
  ]
  let pages: (LegalPage.Editable & { introduction: string })[] = [
    { slug: 'mentions-legales', title: 'Mentions légales', body: 'Avant.', introduction: '' },
  ]
  const dependencies = {
    slideWriter: {
      findAll: () => Promise.resolve(slides),
      findById: (id: number) => Promise.resolve(slides.find((s) => s.id === id) ?? null),
      findBySlug: (slug: string) => Promise.resolve(slides.find((s) => s.slug === slug) ?? null),
      create: (input: Slide.Saved) => {
        const slide = { id: slides.length + 1, ...input }
        slides = [...slides, slide]
        return Promise.resolve(slide)
      },
      update: (id: number, input: Slide.Saved) => {
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
    media: fakeMedia().media,
  }
  return { dependencies, slides: () => slides, pages: () => pages }
}

const slide = (slug: string, imageContent: Uint8Array | null = PHOTO): Slide.Input => ({
  slug,
  title: 'Titre',
  text: '',
  position: 2,
  imageContent,
  imageAlt: 'Une photo',
  imageDecorative: false,
})

describe('Admin : contenus', () => {
  it('refuse un slug déjà pris par une autre diapositive, accepte le sien', async () => {
    const { dependencies } = content()

    await expect(createSlide(dependencies, slide('heliconia'))).rejects.toThrow(
      new ContentRuleViolation('Le slug « heliconia » est déjà pris par une autre diapositive.'),
    )
    await expect(updateSlide(dependencies, 1, slide('heliconia'))).resolves.toBeUndefined()
  })

  it('exige une image à la création, garde l’actuelle à la modification sans fichier', async () => {
    const { dependencies, slides } = content()

    await expect(createSlide(dependencies, slide('anthurium', null))).rejects.toThrow(
      "Une diapositive a besoin d'une image.",
    )
    await updateSlide(dependencies, 1, { ...slide('heliconia', null), imageAlt: 'Bractées rouges' })

    expect(slides()[0]?.image).toEqual({ key: 'a'.repeat(32), alt: 'Bractées rouges' })
  })

  it('refuse une image trop petite une fois recadrée', async () => {
    const { dependencies } = content()

    await expect(
      createSlide(dependencies, slide('anthurium', new TextEncoder().encode('image/png 640x360'))),
    ).rejects.toThrow(
      "Recadrée au format 16:9, l'image doit faire au moins 1280 × 720 px : elle fait 640 × 360 px.",
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

  it('vérifie la forme des saisies', async () => {
    const slideForm = await readSlideForm({ title: '', slug: 'Pas Un Slug', position: 'x' })
    expect(slideForm.data).toBeNull()
    expect(slideForm.errors).toEqual({
      title: 'Cette valeur ne doit pas être vide.',
      slug: 'Minuscules, chiffres et tirets seulement.',
      position: 'Cette valeur doit être un nombre entier.',
    })

    const pageForm = readLegalPageForm({ title: 'Mentions', body: '   ' })
    expect(pageForm.errors).toEqual({ body: 'Cette valeur ne doit pas être vide.' })
  })
})
