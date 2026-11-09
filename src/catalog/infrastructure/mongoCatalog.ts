import { z } from 'zod'

import { nextSequence } from '#/shared/infrastructure/counters.ts'
import { slugFilter, translationsSchema } from '#/shared/infrastructure/translations.ts'

import { ATTRIBUTE_TYPES, EXPOSURES, MAX_GALLERY_IMAGES, SIZES } from '#/catalog/domain/catalog.ts'
import { Price } from '#/catalog/domain/price.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { CounterDocument } from '#/shared/infrastructure/counters.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection, Document, Filter, Sort } from 'mongodb'

const categoryDocumentSchema = z.object({
  _id: z.string().min(1),
  name: z.string().min(1),
  parent: z.string().nullable(),
  position: z.int().min(0),
  /** Nom et slug dans les autres langues (ADR 0014). */
  translations: translationsSchema(),
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
  /** Largeur de la plus grande variante d'une source plus étroite que l'usage (ADR 0008), null sinon. */
  imageWidth: z.int().min(1).nullable(),
  /** Valeurs des attributs renseignés, en chaîne, par code (ADR 0006). */
  attributeValues: z.record(z.string(), z.string()),
  /** Galerie (ADR 0008), dans l'ordre d'affichage, 8 images au plus. */
  gallery: z
    .array(
      z.object({
        key: z.string().regex(/^[0-9a-f]{32}$/),
        alt: z.string(),
        width: z.int().min(1).nullable(),
      }),
    )
    .max(MAX_GALLERY_IMAGES),
  /** Référencement de la fiche (SPEC-COMMUNE, section 26). */
  metaTitle: z.string(),
  metaDescription: z.string(),
  /** Textes dans les autres langues (ADR 0014), slug compris. */
  translations: translationsSchema(),
})

/** Attribut configurable : le code, fixé à la création, sert d'identifiant. */
const productAttributeDocumentSchema = z.object({
  _id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(ATTRIBUTE_TYPES),
  unit: z.string().nullable(),
  filterable: z.boolean(),
  position: z.int().min(0),
  choices: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })),
  /** Libellé, unité et libellés des valeurs dans les autres langues (ADR 0014). */
  translations: translationsSchema(),
})

export type CategoryDocument = z.infer<typeof categoryDocumentSchema>
export type ProductDocument = z.infer<typeof productDocumentSchema>
export type ProductAttributeDocument = z.infer<typeof productAttributeDocumentSchema>

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

export const productAttributeCollection: CollectionDefinition<
  typeof productAttributeDocumentSchema
> = {
  name: 'productAttributes',
  schema: productAttributeDocumentSchema,
  indexes: [{ key: { position: 1 } }],
}

export const toProductAttributeDocument = ({
  code,
  choices,
  ...attribute
}: Catalog.ProductAttribute): ProductAttributeDocument => ({
  _id: code,
  ...attribute,
  choices: choices.map((choice) => ({ ...choice })),
})

const toProductAttribute = ({ _id, ...attribute }: ProductAttributeDocument) => ({
  code: _id,
  ...attribute,
})

export class MongoProductAttributeRepository
  implements Catalog.ProductAttributeRepository, Catalog.ProductAttributeWriter
{
  private readonly collection: Collection<ProductAttributeDocument>

  constructor(collection: Collection<ProductAttributeDocument>) {
    this.collection = collection
  }

  async findAll(): Promise<Catalog.ProductAttribute[]> {
    const documents = await this.collection.find({}, { sort: { position: 1, _id: 1 } }).toArray()
    return documents.map(toProductAttribute)
  }

  async findByCode(code: string): Promise<Catalog.ProductAttribute | null> {
    const document = await this.collection.findOne({ _id: code })
    return document === null ? null : toProductAttribute(document)
  }

  async create(attribute: Catalog.ProductAttribute): Promise<void> {
    await this.collection.insertOne(toProductAttributeDocument(attribute))
  }

  async update(attribute: Catalog.ProductAttribute): Promise<void> {
    await this.collection.replaceOne({ _id: attribute.code }, toProductAttributeDocument(attribute))
  }

  async remove(code: string): Promise<void> {
    await this.collection.deleteOne({ _id: code })
  }
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

  async replaceAll(categories: readonly Catalog.Category[]): Promise<void> {
    await this.collection.deleteMany({})
    if (categories.length > 0) {
      await this.collection.insertMany(
        categories.map(({ slug, ...category }) => ({ _id: slug, ...category })),
      )
    }
  }
}

const SORTS: Record<'relevance' | 'price-asc' | 'price-desc', Sort> = {
  relevance: { _id: 1 },
  'price-asc': { price: 1, _id: 1 },
  'price-desc': { price: -1, _id: 1 },
}

/** Tri stable par `_id` en second critère ; par nom, le nom dans la langue demandée ou celui de la langue par défaut. */
const sortStages = ({ sort, locale }: Catalog.SearchQuery): Document[] =>
  sort === 'name-asc' || sort === 'name-desc'
    ? [
        { $addFields: { sortName: { $ifNull: [`$translations.${locale}.name`, '$name'] } } },
        { $sort: { sortName: sort === 'name-asc' ? 1 : -1, _id: 1 } },
      ]
    : [{ $sort: SORTS[sort ?? 'relevance'] }]

const FRENCH_COLLATION = { locale: 'fr' }

const countResultSchema = z.array(z.object({ _id: z.string(), count: z.int() }))

const totalResultSchema = z.array(z.object({ count: z.int() }))

/** Clés libres : un compteur et un témoin de présence par attribut filtrable (`attribute<n>`, `attributeCarried<n>`). */
const facetResultSchema = z.looseObject({
  items: z.array(productDocumentSchema),
  total: totalResultSchema,
  exposure: countResultSchema,
  size: countResultSchema,
  category: countResultSchema,
})

const countsByKey = (rows: z.infer<typeof countResultSchema>): Record<string, number> =>
  Object.fromEntries(rows.map(({ _id, count }) => [_id, count]))

const countBy = (field: string): Document[] => [
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
]

type StoredImage = Readonly<{ key: string; alt: string; width: number | null }>

const toImage = ({ key, alt, width }: StoredImage): Media.Image =>
  width === null ? { key, alt } : { key, alt, width }

const toStoredImage = ({ key, alt, width }: Media.Image): StoredImage => ({
  key,
  alt,
  width: width ?? null,
})

const toProduct = ({
  _id,
  categoryPath,
  price,
  imageKey,
  imageAlt,
  imageWidth,
  gallery,
  ...product
}: ProductDocument): Catalog.Product => ({
  id: _id,
  ...product,
  price: Price.fromCents(price),
  image: imageKey === null ? null : toImage({ key: imageKey, alt: imageAlt, width: imageWidth }),
  gallery: gallery.map(toImage),
})

const toDocumentFields = ({
  image,
  attributeValues,
  gallery,
  ...product
}: Catalog.ProductSaved) => {
  const { key, alt, width } = toStoredImage(image)
  return {
    ...product,
    imageKey: key,
    imageAlt: alt,
    imageWidth: width,
    attributeValues: { ...attributeValues },
    gallery: gallery.map(toStoredImage),
  }
}

/** Document d'un produit lu, image éventuelle comprise (un produit d'avant l'envoi des images n'en a pas). */
const toStoredProduct = (
  { id, image, gallery, attributeValues, price, ...product }: Catalog.Product,
  categoryPath: readonly string[],
): ProductDocument => ({
  _id: id,
  ...product,
  price,
  imageKey: image?.key ?? null,
  imageAlt: image?.alt ?? '',
  imageWidth: image?.width ?? null,
  attributeValues: { ...attributeValues },
  gallery: gallery.map(toStoredImage),
  categoryPath: [...categoryPath],
})

const attributeField = (code: string): string => `attributeValues.${code}`

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

  async findBySlug(slug: string, locale?: string | null): Promise<Catalog.Product | null> {
    const document = await this.collection.findOne(slugFilter(slug, locale), { sort: { _id: 1 } })
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

  async replaceAll(
    products: readonly {
      readonly product: Catalog.Product
      readonly categoryPath: readonly string[]
    }[],
  ): Promise<void> {
    await this.collection.deleteMany({})
    if (products.length > 0) {
      await this.collection.insertMany(
        products.map(({ product, categoryPath }) => toStoredProduct(product, categoryPath)),
      )
    }
  }

  async removeAttributeValue(code: string): Promise<void> {
    await this.collection.updateMany(
      { [attributeField(code)]: { $exists: true } },
      { $unset: { [attributeField(code)]: '' } },
    )
  }

  async search(query: Catalog.SearchQuery): Promise<Catalog.SearchResult> {
    const branch: Filter<ProductDocument> =
      query.branch === null ? {} : { categoryPath: query.branch }
    const exposure: Filter<ProductDocument> =
      query.exposures.length === 0 ? {} : { exposure: { $in: [...query.exposures] } }
    const size: Filter<ProductDocument> =
      query.sizes.length === 0 ? {} : { size: { $in: [...query.sizes] } }
    /** Filtres d'attributs, sauf celui de `except` (compteur disjonctif de cet attribut). */
    const attributes = (except?: string): Document =>
      Object.fromEntries(
        [...query.attributeFilters]
          .filter(([code]) => code !== except)
          .map(([code, values]) => [attributeField(code), { $in: [...values] }]),
      )
    const priceAndStock: Filter<ProductDocument> = {
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
    const others = { ...priceAndStock, ...attributes() }
    const all = { ...exposure, ...size, ...others }
    // Un attribut n'est compté que si un produit de la branche le porte, quels que soient les filtres
    const attributeFacets = Object.fromEntries(
      query.attributeFacets.flatMap((code, index) => {
        const carried = { [attributeField(code)]: { $exists: true } }
        return [
          [`attributeCarried${index}`, [{ $match: carried }, { $limit: 1 }, { $count: 'count' }]],
          [
            `attribute${index}`,
            [
              {
                $match: { ...carried, ...exposure, ...size, ...priceAndStock, ...attributes(code) },
              },
              ...countBy(attributeField(code)),
            ],
          ],
        ]
      }),
    )

    const pipeline: Document[] = [
      { $match: branch },
      {
        $facet: {
          items: [
            { $match: all },
            ...sortStages(query),
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
          ...attributeFacets,
        },
      },
    ]

    const isNameSort = query.sort === 'name-asc' || query.sort === 'name-desc'
    // Collation de la langue seulement pour le tri par nom : les autres requêtes gardent leurs index
    const [raw] = await this.collection
      .aggregate(pipeline, isNameSort ? { collation: { locale: query.locale } } : {})
      .toArray()
    const result = facetResultSchema.parse(raw)

    return {
      items: result.items.map(toProduct),
      totalItems: result.total[0]?.count ?? 0,
      exposureCounts: countsByKey(result.exposure),
      sizeCounts: countsByKey(result.size),
      categoryCounts: countsByKey(result.category),
      attributeCounts: new Map(
        query.attributeFacets.flatMap((code, index) =>
          totalResultSchema.parse(result[`attributeCarried${index}`]).length === 0
            ? []
            : [[code, countsByKey(countResultSchema.parse(result[`attribute${index}`]))] as const],
        ),
      ),
    }
  }
}
