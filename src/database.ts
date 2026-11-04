import { counterCollection } from '#/shared/infrastructure/counters.ts'
import { ensureCollections, typedCollection } from '#/shared/infrastructure/mongo.ts'

import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
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
import {
  legalPageCollection,
  legalPageFixtures,
  MongoLegalPageRepository,
  MongoSlideRepository,
  slideCollection,
  slideFixtures,
} from '#/content/infrastructure/mongoContent.ts'
import {
  MongoTaskRepository,
  taskCollection,
  taskFixtures,
} from '#/task/infrastructure/mongoTask.ts'

import type { AppDependencies } from '#/app.ts'
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

export const createRepositories = (db: Db): AppDependencies => {
  const categories = new MongoCategoryRepository(typedCollection(db, categoryCollection))
  const products = new MongoProductRepository(
    typedCollection(db, productCollection),
    typedCollection(db, counterCollection),
  )
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
    slides: new MongoSlideRepository(typedCollection(db, slideCollection)),
    legalPages: new MongoLegalPageRepository(typedCollection(db, legalPageCollection)),
    adminUsers: new MongoAdminUserRepository(typedCollection(db, adminUserCollection)),
    passwordHasher: new ScryptPasswordHasher(),
  }
}

/** Recrée la base : collections validées, index, puis les mêmes données que les fixtures Doctrine. */
export const resetDatabase = async (db: Db): Promise<void> => {
  await db.dropDatabase()
  await ensureSchema(db)

  await typedCollection(db, taskCollection).insertMany(taskFixtures)
  await typedCollection(db, articleCollection).insertMany(articleFixtures)
  await typedCollection(db, slideCollection).insertMany(slideFixtures)
  await typedCollection(db, legalPageCollection).insertMany(legalPageFixtures)
  await typedCollection(db, categoryCollection).insertMany(
    categoryFixtures.map(({ slug, ...category }) => ({ _id: slug, ...category })),
  )
  const tree = CategoryTree.of(categoryFixtures)
  await typedCollection(db, productCollection).insertMany(
    productFixtures.map(({ id, ...product }) => ({
      _id: id,
      ...product,
      categoryPath: CategoryTree.pathTo(tree, product.categorySlug),
    })),
  )
}
