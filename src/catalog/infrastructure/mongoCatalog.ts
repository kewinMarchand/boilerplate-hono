import { z } from 'zod'

import { nextSequence } from '#/shared/infrastructure/counters.ts'

import { EXPOSURES, SIZES } from '#/catalog/domain/catalog.ts'
import { Price } from '#/catalog/domain/price.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { CounterDocument } from '#/shared/infrastructure/counters.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection, Document, Filter, Sort } from 'mongodb'

const categoryDocumentSchema = z.object({
  _id: z.string().min(1),
  name: z.string().min(1),
  parent: z.string().nullable(),
  position: z.int().min(0),
})

const productDocumentSchema = z.object({
  _id: z.int().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  categorySlug: z.string().min(1),
  categoryPath: z.array(z.string()).min(1),
  price: z.int().min(0),
  exposure: z.enum(EXPOSURES),
  size: z.enum(SIZES),
  inStock: z.boolean(),
  featured: z.boolean(),
  description: z.string(),
  /** Empreinte de l'image envoyée par l'admin (ADR 0002), null pour un produit d'avant l'envoi des images. */
  imageKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  imageAlt: z.string(),
})

export type CategoryDocument = z.infer<typeof categoryDocumentSchema>
export type ProductDocument = z.infer<typeof productDocumentSchema>

export const categoryCollection: CollectionDefinition<typeof categoryDocumentSchema> = {
  name: 'categories',
  schema: categoryDocumentSchema,
  indexes: [{ key: { parent: 1, position: 1 } }],
}

export const productCollection: CollectionDefinition<typeof productDocumentSchema> = {
  name: 'products',
  schema: productDocumentSchema,
  indexes: [
    { key: { slug: 1 }, unique: true },
    { key: { categoryPath: 1 } },
    { key: { categorySlug: 1 } },
    { key: { price: 1 } },
  ],
}

export class MongoCategoryRepository implements Catalog.CategoryRepository, Catalog.CategoryWriter {
  private readonly collection: Collection<CategoryDocument>

  constructor(collection: Collection<CategoryDocument>) {
    this.collection = collection
  }

  async findAll(): Promise<Catalog.Category[]> {
    const documents = await this.collection.find({}, { sort: { position: 1 } }).toArray()

    return documents.map(({ _id, ...category }) => ({ slug: _id, ...category }))
  }

  async create({ slug, ...category }: Catalog.Category): Promise<void> {
    await this.collection.insertOne({ _id: slug, ...category })
  }

  /** Le slug est l'identifiant : en changer recrée le document et repointe les sous-catégories. */
  async update(previousSlug: string, { slug, ...category }: Catalog.Category): Promise<void> {
    if (slug === previousSlug) {
      await this.collection.updateOne({ _id: slug }, { $set: category })
      return
    }
    await this.collection.insertOne({ _id: slug, ...category })
    await this.collection.updateMany({ parent: previousSlug }, { $set: { parent: slug } })
    await this.collection.deleteOne({ _id: previousSlug })
  }

  async remove(slug: string): Promise<void> {
    await this.collection.deleteOne({ _id: slug })
  }
}

const SORTS: Record<Catalog.Sort | 'relevance', Sort> = {
  relevance: { _id: 1 },
  'price-asc': { price: 1, _id: 1 },
  'price-desc': { price: -1, _id: 1 },
  'name-asc': { name: 1, _id: 1 },
  'name-desc': { name: -1, _id: 1 },
}

const FRENCH_COLLATION = { locale: 'fr' }

const countResultSchema = z.array(z.object({ _id: z.string(), count: z.int() }))

const facetResultSchema = z.object({
  items: z.array(productDocumentSchema),
  total: z.array(z.object({ count: z.int() })),
  exposure: countResultSchema,
  size: countResultSchema,
  category: countResultSchema,
})

const countsByKey = (rows: z.infer<typeof countResultSchema>): Record<string, number> =>
  Object.fromEntries(rows.map(({ _id, count }) => [_id, count]))

const countBy = (field: string): Document[] => [
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
]

const toProduct = ({
  _id,
  categoryPath,
  price,
  imageKey,
  imageAlt,
  ...product
}: ProductDocument): Catalog.Product => ({
  id: _id,
  ...product,
  price: Price.fromCents(price),
  image: imageKey === null ? null : { key: imageKey, alt: imageAlt },
})

const toDocumentFields = ({ image, ...product }: Catalog.ProductSaved) => ({
  ...product,
  imageKey: image.key,
  imageAlt: image.alt,
})

/**
 * Une seule agrégation : la branche est filtrée d'abord, puis `$facet` calcule la page, le
 * total et chaque compteur disjonctif avec ses propres filtres (tous sauf ceux de sa facette).
 */
export class MongoProductRepository implements Catalog.ProductRepository, Catalog.ProductWriter {
  private readonly collection: Collection<ProductDocument>
  private readonly counters: Collection<CounterDocument>

  constructor(collection: Collection<ProductDocument>, counters: Collection<CounterDocument>) {
    this.collection = collection
    this.counters = counters
  }

  async findById(id: number): Promise<Catalog.Product | null> {
    const document = await this.collection.findOne({ _id: id })
    return document === null ? null : toProduct(document)
  }

  async findBySlug(slug: string): Promise<Catalog.Product | null> {
    const document = await this.collection.findOne({ slug })
    return document === null ? null : toProduct(document)
  }

  async findAll(): Promise<Catalog.Product[]> {
    const documents = await this.collection
      .find({}, { sort: { categorySlug: 1, name: 1 }, collation: FRENCH_COLLATION })
      .toArray()
    return documents.map(toProduct)
  }

  async findFeatured(): Promise<Catalog.Product[]> {
    const documents = await this.collection
      .find({ featured: true }, { sort: { name: 1 }, collation: FRENCH_COLLATION })
      .toArray()
    return documents.map(toProduct)
  }

  countInCategory(slug: string): Promise<number> {
    return this.collection.countDocuments({ categorySlug: slug })
  }

  async create(
    product: Catalog.ProductSaved,
    categoryPath: readonly string[],
  ): Promise<Catalog.Product> {
    const [last] = await this.collection.find({}, { sort: { _id: -1 }, limit: 1 }).toArray()
    const id = await nextSequence(this.counters, productCollection.name, last?._id ?? 0)
    const document: ProductDocument = {
      _id: id,
      ...toDocumentFields(product),
      categoryPath: [...categoryPath],
    }
    await this.collection.insertOne(document)

    return toProduct(document)
  }

  async update(
    id: number,
    product: Catalog.ProductSaved,
    categoryPath: readonly string[],
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { ...toDocumentFields(product), categoryPath: [...categoryPath] } },
    )
  }

  async remove(id: number): Promise<void> {
    await this.collection.deleteOne({ _id: id })
  }

  async moveCategory(
    previousSlug: string,
    slug: string,
    categoryPath: readonly string[],
  ): Promise<void> {
    await this.collection.updateMany(
      { categorySlug: previousSlug },
      { $set: { categorySlug: slug, categoryPath: [...categoryPath] } },
    )
  }

  async search(query: Catalog.SearchQuery): Promise<Catalog.SearchResult> {
    const branch: Filter<ProductDocument> =
      query.branch === null ? {} : { categoryPath: query.branch }
    const exposure: Filter<ProductDocument> =
      query.exposures.length === 0 ? {} : { exposure: { $in: [...query.exposures] } }
    const size: Filter<ProductDocument> =
      query.sizes.length === 0 ? {} : { size: { $in: [...query.sizes] } }
    const others: Filter<ProductDocument> = {
      ...(query.priceMin === null && query.priceMax === null
        ? {}
        : {
            price: {
              ...(query.priceMin === null ? {} : { $gte: query.priceMin }),
              ...(query.priceMax === null ? {} : { $lte: query.priceMax }),
            },
          }),
      ...(query.inStockOnly ? { inStock: true } : {}),
    }
    const all = { ...exposure, ...size, ...others }

    const pipeline: Document[] = [
      { $match: branch },
      {
        $facet: {
          items: [
            { $match: all },
            { $sort: SORTS[query.sort ?? 'relevance'] },
            { $skip: query.skip },
            { $limit: query.limit },
          ],
          total: [{ $match: all }, { $count: 'count' }],
          exposure: [{ $match: { ...size, ...others } }, ...countBy('exposure')],
          size: [{ $match: { ...exposure, ...others } }, ...countBy('size')],
          category: [
            { $match: all },
            { $unwind: '$categoryPath' },
            { $match: { categoryPath: { $in: [...query.children] } } },
            ...countBy('categoryPath'),
          ],
        },
      },
    ]

    const isNameSort = query.sort === 'name-asc' || query.sort === 'name-desc'
    const [raw] = await this.collection
      .aggregate(pipeline, isNameSort ? { collation: FRENCH_COLLATION } : {})
      .toArray()
    const result = facetResultSchema.parse(raw)

    return {
      items: result.items.map(toProduct),
      totalItems: result.total[0]?.count ?? 0,
      exposureCounts: countsByKey(result.exposure),
      sizeCounts: countsByKey(result.size),
      categoryCounts: countsByKey(result.category),
    }
  }
}
