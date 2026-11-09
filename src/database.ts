import { readFile } from 'node:fs/promises'

import { counterCollection } from '#/shared/infrastructure/counters.ts'
import { ensureCollections, typedCollection } from '#/shared/infrastructure/mongo.ts'

import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { switchBlogDefaultLocale } from '#/blog/application/adminBlog.ts'
import { switchCatalogDefaultLocale } from '#/catalog/application/adminCatalog.ts'
import { switchContentDefaultLocale } from '#/content/application/adminContent.ts'
import { storeAudio } from '#/media/application/storeAudio.ts'
import { storeImage } from '#/media/application/storeImage.ts'
import { getSiteIdentity } from '#/site/application/siteIdentity.ts'
import {
  adminUserCollection,
  MongoAdminUserRepository,
} from '#/admin/infrastructure/mongoAdminUser.ts'
import { ScryptPasswordHasher } from '#/admin/infrastructure/scryptPasswordHasher.ts'
import { markdownArticle } from '#/blog/infrastructure/markdownArticle.ts'
import {
  articleCollection,
  articleFixtures,
  articleTermCollection,
  articleTermFixtures,
  MongoArticleRepository,
  MongoArticleTermRepository,
} from '#/blog/infrastructure/mongoArticle.ts'
import {
  categoryFixtures,
  productAttributeFixtures,
  productFixtures,
} from '#/catalog/infrastructure/catalogFixtures.ts'
import {
  categoryCollection,
  MongoCategoryRepository,
  MongoProductAttributeRepository,
  MongoProductRepository,
  productAttributeCollection,
  productCollection,
  toProductAttributeDocument,
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
} from '#/content/infrastructure/mongoContent.ts'
import {
  MongoPageMetaRepository,
  pageMetaCollection,
  pageMetaFixtures,
} from '#/content/infrastructure/mongoPageMeta.ts'
import { filesystemMediaStorage } from '#/media/infrastructure/filesystemMediaStorage.ts'
import { headerAudioInspector } from '#/media/infrastructure/headerAudioInspector.ts'
import { fingerprint, sharpImageEncoder } from '#/media/infrastructure/sharpImageEncoder.ts'
import {
  MongoSiteIdentityRepository,
  siteIdentityCollection,
  siteIdentityFixture,
} from '#/site/infrastructure/mongoSiteIdentity.ts'
import {
  MongoTaskRepository,
  taskCollection,
  taskFixtures,
} from '#/task/infrastructure/mongoTask.ts'

import type { AppDependencies } from '#/app.ts'
import type { MediaDependencies } from '#/media/application/storeImage.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { Translations } from '#/shared/domain/translations.ts'
import type { Db } from 'mongodb'

const COLLECTIONS = [
  taskCollection,
  articleCollection,
  articleTermCollection,
  contactMessageCollection,
  counterCollection,
  categoryCollection,
  productCollection,
  productAttributeCollection,
  legalPageCollection,
  pageMetaCollection,
  adminUserCollection,
  siteIdentityCollection,
] as const

/** Collections dont les documents portent des traductions (ADR 0014). */
const TRANSLATABLE = [
  categoryCollection,
  productCollection,
  productAttributeCollection,
  articleCollection,
  articleTermCollection,
  legalPageCollection,
  pageMetaCollection,
] as const

/**
 * Reprise d'une base d'avant le contenu multilingue (ADR 0014), idempotente : chaque document reçoit
 * des traductions vides, l'identité la seule langue `fr`. Le texte actuel reste celui de la langue
 * par défaut, sans copie ni transformation. Le validateur, plus strict, est posé par ensureCollections.
 */
const migrateTranslations = async (db: Db): Promise<void> => {
  // L'identité reçoit ses deux champs dans la même écriture : le validateur exige les deux
  await db
    .collection(siteIdentityCollection.name)
    .updateMany({ locales: { $exists: false } }, { $set: { locales: ['fr'], translations: {} } })
  for (const { name } of TRANSLATABLE) {
    await db
      .collection(name)
      .updateMany({ translations: { $exists: false } }, { $set: { translations: {} } })
  }
}

/** Collections validées et index, puis reprise des documents existants. Lancé au démarrage de l'API. */
export const ensureSchema = async (db: Db): Promise<void> => {
  await ensureCollections(db, COLLECTIONS)
  await migrateTranslations(db)
}

/**
 * Traductions anglaises dormantes des fixtures (ADR 0014) posées sur une base de dev existante, sans
 * la recréer : seulement sur les documents des fixtures encore sans traduction (une saisie de
 * l'admin n'est jamais écrasée). Rend le nombre de documents complétés.
 */
export const addFixtureTranslations = async (db: Db): Promise<number> => {
  const fixtures: readonly (readonly [string, string | number, Translations])[] = [
    ...categoryFixtures.map(
      ({ slug, translations }) => ['categories', slug, translations] as const,
    ),
    ...productFixtures.map(({ id, translations }) => ['products', id, translations] as const),
    ...productAttributeFixtures.map(
      ({ code, translations }) => ['productAttributes', code, translations] as const,
    ),
    ...articleFixtures.map(({ _id, translations }) => ['articles', _id, translations] as const),
    ...articleTermFixtures.map(
      ({ _id, translations }) => ['articleTerms', _id, translations] as const,
    ),
    ...legalPageFixtures.map(({ _id, translations }) => ['legalPages', _id, translations] as const),
    ...pageMetaFixtures.map(({ _id, translations }) => ['pageMetas', _id, translations] as const),
    ['siteIdentity', siteIdentityFixture._id, siteIdentityFixture.translations],
  ]
  let completed = 0
  for (const [collection, id, translations] of fixtures) {
    if (Object.keys(translations).length === 0) {
      continue
    }
    const { modifiedCount } = await db
      .collection<{ _id: string | number }>(collection)
      .updateOne({ _id: id, translations: {} }, { $set: { translations } })
    completed += modifiedCount
  }
  return completed
}

export const mediaDependencies = (directory: string): MediaDependencies => ({
  encoder: sharpImageEncoder,
  audioInspector: headerAudioInspector,
  storage: filesystemMediaStorage(directory),
  fingerprint,
})

/** Tout sauf le mailer, ajouté par l'appelant depuis la configuration (MAILER_DSN, MAILER_FROM), un faux en test. */
export const createRepositories = (
  db: Db,
  media: MediaDependencies,
): Omit<AppDependencies, 'mailer'> => {
  const categories = new MongoCategoryRepository(typedCollection(db, categoryCollection))
  const products = new MongoProductRepository(
    typedCollection(db, productCollection),
    typedCollection(db, counterCollection),
  )
  const attributes = new MongoProductAttributeRepository(
    typedCollection(db, productAttributeCollection),
  )
  const legalPages = new MongoLegalPageRepository(typedCollection(db, legalPageCollection))
  const pageMetas = new MongoPageMetaRepository(typedCollection(db, pageMetaCollection))
  const articleTerms = new MongoArticleTermRepository(
    typedCollection(db, articleTermCollection),
    typedCollection(db, counterCollection),
  )
  const articles = new MongoArticleRepository(
    typedCollection(db, articleCollection),
    typedCollection(db, counterCollection),
    articleTerms,
  )
  const siteIdentities = new MongoSiteIdentityRepository(
    typedCollection(db, siteIdentityCollection),
  )

  return {
    tasks: new MongoTaskRepository(typedCollection(db, taskCollection)),
    articles,
    contactMessages: new MongoContactMessageRepository(
      typedCollection(db, contactMessageCollection),
      typedCollection(db, counterCollection),
    ),
    // Le contact lit le catalogue et l'identité du site par ses propres ports, branchés ici
    contactProducts: {
      find: async (slug, locale) => {
        const product = await products.findBySlug(slug, locale)
        return product === null ? null : { slug: product.slug, name: product.name }
      },
    },
    contactRecipient: {
      address: async () => (await getSiteIdentity({ siteIdentities })).contactRecipient,
    },
    // Nouvelle langue par défaut (ADR 0014) : l'identité la change, chaque module échange ses textes
    switchContentLocale: async (from, to) => {
      await switchCatalogDefaultLocale(
        {
          categories,
          categoryWriter: categories,
          productWriter: products,
          attributes,
          attributeWriter: attributes,
        },
        from,
        to,
      )
      await switchBlogDefaultLocale(
        { articles, articleWriter: articles, articleRenderer: markdownArticle, articleTerms },
        from,
        to,
      )
      await switchContentDefaultLocale(
        {
          legalPageWriter: legalPages,
          legalPageRenderer: markdownLegalPage,
          pageMetaWriter: pageMetas,
        },
        from,
        to,
      )
    },
    categories,
    products,
    categoryWriter: categories,
    productWriter: products,
    attributes,
    attributeWriter: attributes,
    articleWriter: articles,
    articleTerms,
    legalPages,
    legalPageWriter: legalPages,
    legalPageRenderer: markdownLegalPage,
    pageMetas,
    pageMetaWriter: pageMetas,
    articleRenderer: markdownArticle,
    adminUsers: new MongoAdminUserRepository(typedCollection(db, adminUserCollection)),
    passwordHasher: new ScryptPasswordHasher(),
    siteIdentities,
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
): Promise<Media.Image> => {
  const content = new Uint8Array(await readFile(new URL(`${name}.webp`, DEMO_IMAGES)))
  return storeImage(media, { content, alt, decorative }, usage)
}

/** Champs d'image d'un document : empreinte et texte (les photos de démonstration sont assez larges). */
const imageFields = ({ key, alt }: Media.Image) => ({ imageKey: key, imageAlt: alt })

/** Fichiers audio de démonstration (générés, sans droits), comme fixtures/audio de l'API Platform. */
const DEMO_AUDIO = new URL('../fixtures/audio/', import.meta.url)

/** Importe un fichier audio de démonstration par le même chemin que l'admin : même empreinte que dans l'API Platform. */
const demoAudio = async (media: MediaDependencies, name: string | null) => {
  if (name === null) {
    return { audioKey: null, audioFormat: null, audioDuration: null }
  }
  const audio = await storeAudio(
    media,
    new Uint8Array(await readFile(new URL(`${name}.mp3`, DEMO_AUDIO))),
  )
  return { audioKey: audio.key, audioFormat: audio.format, audioDuration: audio.durationSeconds }
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
  await typedCollection(db, articleTermCollection).insertMany(articleTermFixtures)
  await typedCollection(db, articleCollection).insertMany(
    await mapInSequence(
      articleFixtures,
      async ({ demoImage: name, demoAudio: audio, ...article }) => ({
        ...article,
        html: markdownArticle.render(article.body),
        ...imageFields(await demoImage(media, name, 'article', '', true)),
        ...(await demoAudio(media, audio)),
      }),
    ),
  )
  await typedCollection(db, legalPageCollection).insertMany(legalPageFixtures)
  await typedCollection(db, pageMetaCollection).insertMany(pageMetaFixtures)
  await typedCollection(db, siteIdentityCollection).insertOne(siteIdentityFixture)
  await typedCollection(db, categoryCollection).insertMany(
    categoryFixtures.map(({ slug, ...category }) => ({ _id: slug, ...category })),
  )
  await typedCollection(db, productAttributeCollection).insertMany(
    productAttributeFixtures.map(toProductAttributeDocument),
  )
  const tree = CategoryTree.of(categoryFixtures)
  await typedCollection(db, productCollection).insertMany(
    await mapInSequence(
      productFixtures,
      async ({ id, demoImage: name, galleryImages, ...product }) => ({
        _id: id,
        ...product,
        attributeValues: { ...product.attributeValues },
        ...imageFields(await demoImage(media, name, 'product', product.name)),
        imageWidth: null,
        gallery: (
          await mapInSequence(galleryImages, (photo) =>
            demoImage(media, photo, 'product', product.name),
          )
        ).map(({ key, alt }) => ({ key, alt, width: null })),
        categoryPath: CategoryTree.pathTo(tree, product.categorySlug),
      }),
    ),
  )
}
