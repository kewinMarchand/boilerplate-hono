import { connectMongo } from '#/shared/infrastructure/mongo.ts'

import { loadConfig } from '#/config.ts'
import { addFixtureTranslations, ensureSchema } from '#/database.ts'

const config = loadConfig()
if (config.APP_ENV === 'prod') {
  console.error('Traductions des fixtures refusées en production.')
  process.exit(1)
}
const client = await connectMongo(config.MONGODB_URI)
try {
  const db = client.db(config.MONGODB_DB)
  await ensureSchema(db)
  const completed = await addFixtureTranslations(db)
  console.info(
    `Base ${config.MONGODB_DB} : ${completed} document(s) complété(s) des traductions des fixtures.`,
  )
} finally {
  await client.close()
}
