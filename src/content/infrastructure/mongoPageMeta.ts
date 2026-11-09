import { z } from 'zod'

import { translationsSchema } from '#/shared/infrastructure/translations.ts'

import { META_PAGES } from '#/content/domain/PageMeta.ts'

import type { PageMeta } from '#/content/domain/PageMeta.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const PAGES = META_PAGES.map(([page]) => page)

/** Référencement d'une page fixe (ADR 0010) : la clé de la page sert d'identifiant. */
const pageMetaDocumentSchema = z.object({
  _id: z.enum(PAGES),
  title: z.string().max(60),
  description: z.string().max(160),
  /** Titre et description dans les autres langues (ADR 0014). */
  translations: translationsSchema(),
})

type PageMetaDocument = z.infer<typeof pageMetaDocumentSchema>

export const pageMetaCollection: CollectionDefinition<typeof pageMetaDocumentSchema> = {
  name: 'pageMetas',
  schema: pageMetaDocumentSchema,
  indexes: [],
}

/** Description du blog des fixtures, la seule saisie, comme PageMetaFixtures::BLOG_DESCRIPTION. */
export const BLOG_DESCRIPTION =
  'Conseils et actualités du modèle : rendu serveur, accessibilité, composants sans dépendance.'

/** Dormante tant que le site n'active que le français (ADR 0014), comme PageMetaFixtures::BLOG_DESCRIPTION_EN. */
export const BLOG_DESCRIPTION_EN =
  'Tips and news from the template: server rendering, accessibility, dependency-free components.'

/** Une ligne par page fixe, vide, sauf la description du blog, qui exerce le contrat. */
export const pageMetaFixtures: PageMetaDocument[] = PAGES.map((page) => ({
  _id: page,
  title: '',
  description: page === 'blog' ? BLOG_DESCRIPTION : '',
  translations: page === 'blog' ? { en: { description: BLOG_DESCRIPTION_EN } } : {},
}))

const toPageMeta = ({
  _id,
  title,
  description,
  translations,
}: PageMetaDocument): PageMeta.Entity => ({
  page: _id,
  title,
  description,
  translations,
})

export class MongoPageMetaRepository implements PageMeta.Repository, PageMeta.Writer {
  private readonly collection: Collection<PageMetaDocument>

  constructor(collection: Collection<PageMetaDocument>) {
    this.collection = collection
  }

  async findAll(): Promise<PageMeta.Entity[]> {
    return (await this.collection.find().toArray()).map(toPageMeta)
  }

  async find(page: PageMeta.Page): Promise<PageMeta.Entity | null> {
    const document = await this.collection.findOne({ _id: page })
    return document === null ? null : toPageMeta(document)
  }

  async update(page: PageMeta.Page, meta: Omit<PageMeta.Entity, 'page'>): Promise<void> {
    await this.collection.updateOne({ _id: page }, { $set: meta })
  }
}
