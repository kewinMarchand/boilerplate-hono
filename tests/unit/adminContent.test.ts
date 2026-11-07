import { describe, expect, it } from 'vitest'

import { updateLegalPage } from '#/content/application/adminContent.ts'
import { readLegalPageForm } from '#/content/http/adminContent.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'

const content = () => {
  let pages: (LegalPage.Editable & { introduction: string })[] = [
    { slug: 'mentions-legales', title: 'Mentions légales', body: 'Avant.', introduction: '' },
  ]
  const dependencies = {
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
  return { dependencies, pages: () => pages }
}

describe('Admin : contenus', () => {
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
    const pageForm = readLegalPageForm({ title: 'Mentions', body: '   ' })
    expect(pageForm.errors).toEqual({ body: 'Cette valeur ne doit pas être vide.' })
  })
})
