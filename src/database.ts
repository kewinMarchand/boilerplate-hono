import { readFile } from 'node:fs/promises'

import { counterCollection } from '#/shared/infrastructure/counters.ts'
import { ensureCollections, typedCollection } from '#/shared/infrastructure/mongo.ts'

import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { storeImage } from '#/media/application/storeImage.ts'
import {
  adminUserCollection,
  MongoAdminUserRepository,
} from '#/admin/infrastructure/mongoAdminUser.ts'
import { ScryptPasswordHasher } from '#/admin/infrastructure/scryptPasswordHasher.ts'
import {
  articleCollection,
  articleFixtures,
  MongoArticleRepository,
} from '#/blog/infrastructure/mongoArticle.ts'
import { categoryFixtures, productFixtures } from '#/catalog/infrastructure/catalogFixtures.ts'
import {
  categoryCollection,
  MongoCategoryRepository,
  MongoProductRepository,
  productCollection,
} from '#/catalog/infrastructure/mongoCatalog.ts'
import {
  contactMessageCollection,
  MongoContactMessageRepository,
} from '#/contact/infrastructure/mongoContactMessage.ts'
import { markdownLegalPage } from '#/content/infrastructure/markdownLegalPage.ts'
import {
  legalPageCollection,
  legalPageFixtures,
  MongoLegalPageRepository,
  MongoSlideRepository,
  slideCollection,
  slideFixtures,
} from '#/content/infrastructure/mongoContent.ts'
import { filesystemMediaStorage } from '#/media/infrastructure/filesystemMediaStorage.ts'
import { fingerprint, sharpImageEncoder } from '#/media/infrastructure/sharpImageEncoder.ts'
import {
  MongoTaskRepository,
  taskCollection,
  taskFixtures,
} from '#/task/infrastructure/mongoTask.ts'

import type { AppDependencies } from '#/app.ts'
import type { MediaDependencies } from '#/media/application/storeImage.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { Db } from 'mongodb'

const COLLECTIONS = [
  taskCollection,
  articleCollection,
  contactMessageCollection,
  counterCollection,
  categoryCollection,
  productCollection,
  slideCollection,
  legalPageCollection,
  adminUserCollection,
] as const

export const ensureSchema = (db: Db): Promise<void> => ensureCollections(db, COLLECTIONS)

export const mediaDependencies = (directory: string): MediaDependencies => ({
  encoder: sharpImageEncoder,
  storage: filesystemMediaStorage(directory),
  fingerprint,
})

export const createRepositories = (db: Db, media: MediaDependencies): AppDependencies => {
  const categories = new MongoCategoryRepository(typedCollection(db, categoryCollection))
  const products = new MongoProductRepository(
    typedCollection(db, productCollection),
    typedCollection(db, counterCollection),
  )
  const slides = new MongoSlideRepository(
    typedCollection(db, slideCollection),
    typedCollection(db, counterCollection),
  )
  const legalPages = new MongoLegalPageRepository(typedCollection(db, legalPageCollection))
  const articles = new MongoArticleRepository(
    typedCollection(db, articleCollection),
    typedCollection(db, counterCollection),
  )

  return {
    tasks: new MongoTaskRepository(typedCollection(db, taskCollection)),
    articles,
    contactMessages: new MongoContactMessageRepository(
      typedCollection(db, contactMessageCollection),
      typedCollection(db, counterCollection),
    ),
    categories,
    products,
    categoryWriter: categories,
    productWriter: products,
    articleWriter: articles,
    slides,
    legalPages,
    slideWriter: slides,
    legalPageWriter: legalPages,
    legalPageRenderer: markdownLegalPage,
    adminUsers: new MongoAdminUserRepository(typedCollection(db, adminUserCollection)),
    passwordHasher: new ScryptPasswordHasher(),
    media,
  }
}

/** Photos de démonstration, copiées de boilerplates-commun/shared-assets comme dans l'API Platform. */
const DEMO_IMAGES = new URL('../fixtures/images/', import.meta.url)

/**
 * Importe une photo de démonstration par le même chemin que l'admin (contrôles, variantes, stockage) :
 * même fichier, même empreinte, donc les mêmes adresses que dans l'API Platform.
 */
const demoImage = async (
  media: MediaDependencies,
  name: string,
  usage: Media.Usage,
  alt: string,
  decorative = false,
): Promise<{ imageKey: string; imageAlt: string }> => {
  const content = new Uint8Array(await readFile(new URL(`${name}.webp`, DEMO_IMAGES)))
  const image = await storeImage(media, { content, alt, decorative }, usage)
  return { imageKey: image.key, imageAlt: image.alt }
}

/** Un à un : deux fixtures qui partagent une photo ne l'encodent pas deux fois en même temps. */
const mapInSequence = async <T, R>(items: readonly T[], map: (item: T) => Promise<R>) => {
  const results: R[] = []
  for (const item of items) {
    results.push(await map(item))
  }
  return results
}

/**
 * Encode d'avance les photos de démonstration de toutes les fixtures (préparation des tests) : les
 * remises à zéro qui suivent les trouvent stockées et n'encodent plus rien.
 */
export const importDemoImages = async (media: MediaDependencies): Promise<void> => {
  await mapInSequence(slideFixtures, ({ demoImage: name, alt }) =>
    demoImage(media, name, 'slide', alt),
  )
  await mapInSequence(productFixtures, ({ demoImage: name, name: alt }) =>
    demoImage(media, name, 'product', alt),
  )
  await mapInSequence(articleFixtures, ({ demoImage: name }) =>
    demoImage(media, name, 'article', '', true),
  )
}

/** Recrée la base : collections validées, index, puis les mêmes données que les fixtures Doctrine. */
export const resetDatabase = async (db: Db, media: MediaDependencies): Promise<void> => {
  await db.dropDatabase()
  await ensureSchema(db)

  await typedCollection(db, taskCollection).insertMany(taskFixtures)
  await typedCollection(db, articleCollection).insertMany(
    await mapInSequence(articleFixtures, async ({ demoImage: name, ...article }) => ({
      ...article,
      ...(await demoImage(media, name, 'article', '', true)),
    })),
  )
  await typedCollection(db, slideCollection).insertMany(
    await mapInSequence(slideFixtures, async ({ demoImage: name, alt, ...slide }) => ({
      ...slide,
      ...(await demoImage(media, name, 'slide', alt)),
    })),
  )
  await typedCollection(db, legalPageCollection).insertMany(legalPageFixtures)
  await typedCollection(db, categoryCollection).insertMany(
    categoryFixtures.map(({ slug, ...category }) => ({ _id: slug, ...category })),
  )
  const tree = CategoryTree.of(categoryFixtures)
  await typedCollection(db, productCollection).insertMany(
    await mapInSequence(productFixtures, async ({ id, demoImage: name, ...product }) => ({
      _id: id,
      ...product,
      ...(await demoImage(media, name, 'product', product.name)),
      categoryPath: CategoryTree.pathTo(tree, product.categorySlug),
    })),
  )
}
