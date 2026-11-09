import { describe, expect, it } from 'vitest'

import { BlogRuleViolation } from '#/blog/domain/Article.ts'
import { MediaRuleViolation } from '#/media/domain/imageRules.ts'
import {
  createArticle,
  createArticleTerm,
  deleteArticle,
  deleteArticleTerm,
  updateArticle,
  updateArticleTerm,
} from '#/blog/application/adminBlog.ts'
import { readArticleTermForm } from '#/blog/http/adminArticleTerms.ts'
import { readArticleForm } from '#/blog/http/adminBlog.ts'

import { fakeMedia, PHOTO, photo, testImage } from './fakeMedia.ts'

import type { Article } from '#/blog/domain/Article.ts'

type Stored = Omit<Article.Entity, 'section' | 'format'> & {
  readonly sectionId: number | null
  readonly formatId: number | null
}

const blog = () => {
  let terms: Article.Term[] = [
    { id: 1, kind: 'section', slug: 'conseils', name: 'Conseils', position: 1, translations: {} },
    {
      id: 2,
      kind: 'section',
      slug: 'actualites',
      name: 'Actualités',
      position: 2,
      translations: {},
    },
    { id: 3, kind: 'format', slug: 'guide', name: 'Guide', position: 1, translations: {} },
  ]
  const stored = (fields: Partial<Stored> & Pick<Stored, 'id' | 'slug'>): Stored => ({
    title: 'Titre',
    excerpt: '',
    publishedAt: '2026-01-10',
    image: testImage(''),
    body: '',
    html: '',
    sectionId: null,
    formatId: null,
    translations: {},
    audio: null,
    speaker: '',
    metaTitle: '',
    metaDescription: '',
    ...fields,
  })
  let articles: Stored[] = [
    stored({ id: 1, slug: 'rempoter', sectionId: 1, formatId: 3 }),
    stored({ id: 2, slug: 'arroser', sectionId: 1 }),
  ]
  const term = (id: number | null) => terms.find((t) => t.id === id) ?? null
  const entity = ({ sectionId, formatId, ...article }: Stored): Article.Entity => ({
    ...article,
    section: term(sectionId),
    format: term(formatId),
  })
  const find = (predicate: (article: Stored) => boolean) => {
    const article = articles.find(predicate)
    return Promise.resolve(article === undefined ? null : entity(article))
  }
  const articleWriter: Article.Writer = {
    findById: (id) => find((a) => a.id === id),
    findBySlug: (slug) => find((a) => a.slug === slug),
    create: (input) => {
      const article = { id: articles.length + 1, ...input }
      articles = [...articles, article]
      return Promise.resolve(entity(article))
    },
    update: (id, input) => {
      articles = articles.map((a) => (a.id === id ? { id, ...input } : a))
      return Promise.resolve()
    },
    remove: (id) => {
      articles = articles.filter((a) => a.id !== id)
      return Promise.resolve()
    },
  }
  const articleTerms: Article.TermRepository = {
    findByKind: (kind) =>
      Promise.resolve(
        terms
          .filter((t) => t.kind === kind)
          .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
      ),
    findById: (id) => Promise.resolve(term(id)),
    findBySlug: (kind, slug) =>
      Promise.resolve(terms.find((t) => t.kind === kind && t.slug === slug) ?? null),
    create: (kind, input) => {
      const created = { id: terms.length + 1, kind, ...input }
      terms = [...terms, created]
      return Promise.resolve(created)
    },
    update: (id, input) => {
      terms = terms.map((t) => (t.id === id ? { ...t, ...input } : t))
      return Promise.resolve()
    },
    remove: (id) => {
      terms = terms.filter((t) => t.id !== id)
      return Promise.resolve()
    },
  }
  const media = fakeMedia()
  return {
    dependencies: {
      articles: {
        findLatestFirst: () => Promise.resolve(articles.map(entity)),
        findBySlug: (slug: string) => articleWriter.findBySlug(slug),
      },
      articleWriter,
      articleRenderer: { render: (markdown: string) => `<p>${markdown}</p>\n` },
      articleTerms,
      media: media.media,
    },
    all: () => articles.map(entity),
    terms: () => terms,
    files: media.files,
  }
}

const input = (
  slug: string,
  imageContent: Uint8Array | null = PHOTO,
  fields: Partial<Article.Input> = {},
): Article.Input => ({
  slug,
  title: 'Titre',
  excerpt: '',
  publishedAt: '2026-02-01',
  imageContent,
  imageAlt: '',
  imageDecorative: true,
  body: 'Texte',
  sectionId: null,
  formatId: null,
  audioContent: null,
  removeAudio: false,
  speaker: '',
  metaTitle: '',
  metaDescription: '',
  ...fields,
})

const AUDIO = photo('audio/ogg 3.0')

describe('Admin : blog', () => {
  it('refuse un slug déjà pris par un autre article, accepte le sien', async () => {
    const { dependencies } = blog()

    await expect(createArticle(dependencies, input('rempoter'))).rejects.toThrow(
      new BlogRuleViolation('Le slug « rempoter » est déjà pris par un autre article.'),
    )
    await expect(updateArticle(dependencies, 1, input('rempoter'))).resolves.toBeUndefined()
  })

  it('refuse de modifier ou supprimer un article disparu', async () => {
    const { dependencies } = blog()

    await expect(updateArticle(dependencies, 9, input('autre'))).rejects.toThrow(
      "Cet article n'existe plus.",
    )
    await expect(deleteArticle(dependencies, 9)).rejects.toThrow("Cet article n'existe plus.")
  })

  it('crée un article avec son texte converti, puis le supprime', async () => {
    const { dependencies, all } = blog()

    const created = await createArticle(dependencies, input('tailler'))
    expect([created.body, created.html]).toEqual(['Texte', '<p>Texte</p>\n'])
    expect([created.section, created.format, created.audio, created.speaker]).toEqual([
      null,
      null,
      null,
      '',
    ])
    await deleteArticle(dependencies, created.id)

    expect(all().map((a) => a.slug)).toEqual(['rempoter', 'arroser'])
  })

  it('exige une image à la création, accepte une image décorative', async () => {
    const { dependencies } = blog()

    await expect(createArticle(dependencies, input('bouturer', null))).rejects.toThrow(
      "Un article a besoin d'une image.",
    )
    expect((await createArticle(dependencies, input('tailler'))).image?.alt).toBe('')
  })

  it('refuse une date de publication qui n’existe pas', async () => {
    const form = await readArticleForm({
      title: 'T',
      slug: 't',
      excerpt: '',
      publishedAt: '2026-02-30',
    })

    expect(form.data).toBeNull()
    expect(form.errors.publishedAt).toBe('Veuillez entrer une date valide.')
  })

  it('enregistre rubrique, format, audio, intervenant et référencement, sans blancs autour', async () => {
    const { dependencies, files } = blog()

    const created = await createArticle(
      dependencies,
      input('bouturer', PHOTO, {
        sectionId: 1,
        formatId: 3,
        audioContent: AUDIO,
        speaker: ' Présenté par Hina Teriierooiterai ',
        metaTitle: ' Titre court ',
        metaDescription: 'Description.',
      }),
    )

    expect([created.section?.slug, created.format?.slug]).toEqual(['conseils', 'guide'])
    expect([created.audio?.format, created.audio?.durationSeconds]).toEqual(['ogg', 3])
    expect(files.has(`${created.audio?.key}.ogg`)).toBe(true)
    expect([created.speaker, created.metaTitle, created.metaDescription]).toEqual([
      'Présenté par Hina Teriierooiterai',
      'Titre court',
      'Description.',
    ])
  })

  it('refuse une rubrique qui est un format, et un format disparu', async () => {
    const { dependencies } = blog()

    await expect(createArticle(dependencies, input('a', PHOTO, { sectionId: 3 }))).rejects.toThrow(
      new BlogRuleViolation("Cette rubrique n'existe plus."),
    )
    await expect(createArticle(dependencies, input('a', PHOTO, { formatId: 99 }))).rejects.toThrow(
      new BlogRuleViolation("Ce format n'existe plus."),
    )
  })

  it('refuse un fichier qui n’est pas de l’audio et un intervenant de plus de 80 caractères', async () => {
    const { dependencies } = blog()

    await expect(
      createArticle(dependencies, input('a', PHOTO, { audioContent: photo('video/mp4') })),
    ).rejects.toThrow(
      new MediaRuleViolation('Le fichier ne se lit pas comme un fichier audio MP3, M4A ou OGG.'),
    )
    await expect(
      createArticle(dependencies, input('a', PHOTO, { speaker: 'é'.repeat(81) })),
    ).rejects.toThrow(new BlogRuleViolation("L'intervenant compte 80 caractères au plus."))
  })

  it('garde l’audio sans nouveau fichier, puis le retire même si un fichier est envoyé', async () => {
    const { dependencies } = blog()
    await updateArticle(dependencies, 1, input('rempoter', null, { audioContent: AUDIO }))
    const audio = (await dependencies.articleWriter.findById(1))?.audio

    await updateArticle(dependencies, 1, input('rempoter', null))
    expect((await dependencies.articleWriter.findById(1))?.audio).toEqual(audio)

    await updateArticle(
      dependencies,
      1,
      input('rempoter', null, { removeAudio: true, audioContent: AUDIO }),
    )
    expect((await dependencies.articleWriter.findById(1))?.audio).toBeNull()
  })
})

describe('Admin : rubriques et formats', () => {
  const term = (slug: string, name: string, position: number): Article.TermInput => ({
    slug,
    name,
    position,
  })

  it('crée une rubrique, rangée par position', async () => {
    const { dependencies } = blog()

    await createArticleTerm(dependencies, 'section', term('jardin', 'Jardin', 3))

    expect((await dependencies.articleTerms.findByKind('section')).map(({ slug }) => slug)).toEqual(
      ['conseils', 'actualites', 'jardin'],
    )
  })

  it('n’exige un slug unique que dans sa liste', async () => {
    const { dependencies } = blog()

    await createArticleTerm(dependencies, 'format', term('conseils', 'Conseils', 2))
    await expect(
      createArticleTerm(dependencies, 'format', term('guide', 'Guide bis', 3)),
    ).rejects.toThrow(new BlogRuleViolation('Le slug « guide » est déjà pris par un autre format.'))
  })

  it('modifie une rubrique, refuse le slug d’une autre et un terme de l’autre liste', async () => {
    const { dependencies, terms } = blog()

    await updateArticleTerm(dependencies, 2, 'section', term('actualites', 'Nouvelles', 0))
    expect(terms().find(({ id }) => id === 2)).toMatchObject({ name: 'Nouvelles', position: 0 })
    await expect(
      updateArticleTerm(dependencies, 2, 'section', term('conseils', 'Nouvelles', 0)),
    ).rejects.toThrow(
      new BlogRuleViolation('Le slug « conseils » est déjà pris par une autre rubrique.'),
    )
    await expect(
      updateArticleTerm(dependencies, 3, 'section', term('guide', 'Guide', 1)),
    ).rejects.toThrow(new BlogRuleViolation("Cette rubrique n'existe plus."))
  })

  it('refuse de supprimer un terme porté par des articles, accordé à la sorte', async () => {
    const { dependencies } = blog()

    await expect(deleteArticleTerm(dependencies, 1, 'section')).rejects.toThrow(
      new BlogRuleViolation('La rubrique Conseils est utilisée par 2 articles.'),
    )
    await expect(deleteArticleTerm(dependencies, 3, 'format')).rejects.toThrow(
      new BlogRuleViolation('Le format Guide est utilisé par 1 article.'),
    )
  })

  it('supprime une rubrique inutilisée', async () => {
    const { dependencies, terms } = blog()

    await deleteArticleTerm(dependencies, 2, 'section')

    expect(terms().map(({ slug }) => slug)).toEqual(['conseils', 'guide'])
  })

  it('vérifie la forme d’un terme : nom, slug, position', () => {
    const form = readArticleTermForm({ name: '', slug: '-guide', position: '-1' })

    expect(form.data).toBeNull()
    expect(form.errors).toEqual({
      name: 'Cette valeur ne doit pas être vide.',
      slug: 'Minuscules, chiffres et tirets, 60 caractères au plus, sans tiret au début.',
      position: 'Cette valeur doit être positive ou nulle.',
    })
  })
})
