import { readFileSync } from 'node:fs'

import { connectMongo } from '#/shared/infrastructure/mongo.ts'

import { fingerprint } from '#/media/infrastructure/sharpImageEncoder.ts'
import { toImageView } from '#/media/http/imageContract.ts'

import { createApp } from '#/app.ts'
import { loadConfig } from '#/config.ts'
import { createRepositories, mediaDependencies, resetDatabase } from '#/database.ts'

import type { AppConfig } from '#/app.ts'
import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { Db, MongoClient } from 'mongodb'

/** Faux transport des mails : les garde au lieu de les envoyer, ou échoue tant que `failure` est renseignée. */
export class FakeMailer implements ContactMessage.Mailer {
  readonly sent: ContactMessage.Mail[] = []
  failure: Error | null = null

  send(mail: ContactMessage.Mail): Promise<void> {
    if (this.failure !== null) {
      return Promise.reject(this.failure)
    }
    this.sent.push(mail)
    return Promise.resolve()
  }
}

export interface TestContext {
  readonly app: ReturnType<typeof createApp>
  readonly mailer: FakeMailer
  readonly db: Db
  readonly client: MongoClient
  readonly close: () => Promise<void>
}

/** Variantes des tests, à part de celles de la base de dev. */
export const TEST_MEDIA_DIR = 'var/test-media'

/** Une base par fichier de test, recréée avec les fixtures : les fichiers tournent en parallèle. */
export const createTestContext = async (
  name: string,
  overrides: Partial<AppConfig> = {},
): Promise<TestContext> => {
  const config = loadConfig()
  const client = await connectMongo(config.MONGODB_URI)
  const db = client.db(`${config.MONGODB_DB}_${name}`)
  const media = mediaDependencies(TEST_MEDIA_DIR)
  await resetDatabase(db, media)
  const mailer = new FakeMailer()
  const app = createApp(
    { ...createRepositories(db, media), mailer },
    { ...config, MEDIA_DIR: TEST_MEDIA_DIR, ...overrides },
  )

  return {
    app,
    mailer,
    db,
    client,
    close: async () => {
      await db.dropDatabase()
      await client.close()
    },
  }
}

/** Image attendue dans le contrat pour une photo de démonstration importée par resetDatabase. */
export const demoView = (name: string, usage: Media.Usage, alt: string) => {
  const content = new Uint8Array(
    readFileSync(new URL(`../../fixtures/images/${name}.webp`, import.meta.url)),
  )
  return toImageView('http://localhost:8091', { key: fingerprint(usage, content), alt }, usage)
}

export const getJson = async (
  context: TestContext,
  path: string,
  headers: Record<string, string> = {},
) => {
  const response = await context.app.request(path, {
    headers: { Accept: 'application/json', ...headers },
  })
  const body: unknown = await response.json()

  return { response, body }
}
