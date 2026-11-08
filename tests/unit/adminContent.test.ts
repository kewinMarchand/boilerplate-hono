import { describe, expect, it } from 'vitest'

import { updateLegalPage, updatePageMeta } from '#/content/application/adminContent.ts'
import { readLegalPageForm } from '#/content/http/adminContent.ts'
import { readPageMetaForm } from '#/content/http/adminPageMeta.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { PageMeta } from '#/content/domain/PageMeta.ts'

const content = () => {
  let pages: (LegalPage.Editable & { introduction: string })[] = [
    { slug: 'mentions-legales', title: 'Mentions légales', body: 'Avant.', introduction: '' },
  ]
  let metas: PageMeta.Entity[] = [{ page: 'home', title: '', description: '' }]
  const dependencies = {
    pageMetaWriter: {
      findAll: () => Promise.resolve(metas),
      find: (page: PageMeta.Page) => Promise.resolve(metas.find((m) => m.page === page) ?? null),
      update: (page: PageMeta.Page, meta: PageMeta.Input) => {
        metas = metas.map((m) => (m.page === page ? { page, ...meta } : m))
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
  return { dependencies, pages: () => pages, metas: () => metas }
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

  it('enregistre le référencement d’une page fixe sans blancs autour', async () => {
    const { dependencies, metas } = content()

    await updatePageMeta(dependencies, 'home', { title: ' Oraki ', description: 'Plantes. ' })

    expect(metas()).toEqual([{ page: 'home', title: 'Oraki', description: 'Plantes.' }])
    await expect(
      updatePageMeta(dependencies, 'blog', { title: '', description: '' }),
    ).rejects.toThrow("Cette page n'existe plus.")
  })

  it('refuse un titre de plus de 60 caractères et une description de plus de 160', () => {
    const form = readPageMetaForm({ title: 'a'.repeat(61), description: 'b'.repeat(161) })

    expect(form.errors).toEqual({
      title: 'Cette chaîne est trop longue. Elle doit avoir au maximum 60 caractères.',
      description: 'Cette chaîne est trop longue. Elle doit avoir au maximum 160 caractères.',
    })
  })
})
