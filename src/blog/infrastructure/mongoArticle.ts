import { z } from 'zod'

import { nextSequence } from '#/shared/infrastructure/counters.ts'

import type { Article } from '#/blog/domain/Article.ts'
import type { CounterDocument } from '#/shared/infrastructure/counters.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const articleDocumentSchema = z.object({
  _id: z.int().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string(),
  publishedAt: z.date(),
  /** Empreinte de l'image envoyée par l'admin (ADR 0002), null pour un article d'avant l'envoi des images. */
  imageKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  imageAlt: z.string(),
})

type ArticleDocument = z.infer<typeof articleDocumentSchema>

/** Fixture : l'illustration de démonstration (fixtures/images), décorative, importée par resetDatabase. */
export type ArticleFixture = Omit<ArticleDocument, 'imageKey' | 'imageAlt'> & {
  readonly demoImage: string
}

export const articleCollection: CollectionDefinition<typeof articleDocumentSchema> = {
  name: 'articles',
  schema: articleDocumentSchema,
  indexes: [{ key: { slug: 1 }, unique: true }, { key: { publishedAt: -1, _id: -1 } }],
}

export const articleFixtures: ArticleFixture[] = [
  {
    _id: 1,
    slug: 'pourquoi-rendre-le-contenu-cote-serveur',
    title: 'Pourquoi rendre le contenu côté serveur',
    excerpt: 'Le contenu éditorial arrive dans le HTML initial : meilleur référencement et LCP.',
    publishedAt: new Date('2026-09-15T00:00:00Z'),
    demoImage: 'blog-1',
  },
  {
    _id: 2,
    slug: 'un-carrousel-accessible-sans-dependance',
    title: 'Un carrousel accessible sans dépendance',
    excerpt: 'Défilement natif, boutons explicites, pas de lecture automatique.',
    publishedAt: new Date('2026-09-22T00:00:00Z'),
    demoImage: 'blog-2',
  },
  {
    _id: 3,
    slug: 'le-mode-accessibilite-renforcee',
    title: 'Le mode accessibilité renforcée',
    excerpt: 'Texte agrandi, espacements WCAG 1.4.12 et contraste AAA, sans logique dupliquée.',
    publishedAt: new Date('2026-10-01T00:00:00Z'),
    demoImage: 'blog-3',
  },
]

const toArticle = ({
  _id,
  slug,
  title,
  excerpt,
  publishedAt,
  imageKey,
  imageAlt,
}: ArticleDocument): Article.Entity => ({
  id: _id,
  slug,
  title,
  excerpt,
  publishedAt: publishedAt.toISOString().slice(0, 10),
  image: imageKey === null ? null : { key: imageKey, alt: imageAlt },
})

/** Champs dans l'ordre des fixtures, que suit le JSON de l'API. */
const toDocument = ({ slug, title, excerpt, publishedAt, image }: Article.Saved) => ({
  slug,
  title,
  excerpt,
  publishedAt: new Date(`${publishedAt}T00:00:00Z`),
  imageKey: image.key,
  imageAlt: image.alt,
})

export class MongoArticleRepository implements Article.Repository, Article.Writer {
  private readonly collection: Collection<ArticleDocument>
  private readonly counters: Collection<CounterDocument>

  constructor(collection: Collection<ArticleDocument>, counters: Collection<CounterDocument>) {
    this.collection = collection
    this.counters = counters
  }

  async findById(id: number): Promise<Article.Entity | null> {
    const document = await this.collection.findOne({ _id: id })
    return document === null ? null : toArticle(document)
  }

  async findBySlug(slug: string): Promise<Article.Entity | null> {
    const document = await this.collection.findOne({ slug })
    return document === null ? null : toArticle(document)
  }

  async create(input: Article.Saved): Promise<Article.Entity> {
    const [last] = await this.collection.find({}, { sort: { _id: -1 }, limit: 1 }).toArray()
    const id = await nextSequence(this.counters, articleCollection.name, last?._id ?? 0)
    const document: ArticleDocument = { _id: id, ...toDocument(input) }
    await this.collection.insertOne(document)

    return toArticle(document)
  }

  async update(id: number, input: Article.Saved): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: toDocument(input) })
  }

  async remove(id: number): Promise<void> {
    await this.collection.deleteOne({ _id: id })
  }

  async findLatestFirst(): Promise<Article.Entity[]> {
    const documents = await this.collection
      .find({}, { sort: { publishedAt: -1, _id: -1 } })
      .toArray()

    return documents.map(toArticle)
  }
}
