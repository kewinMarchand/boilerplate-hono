import { connectMongo } from '#/shared/infrastructure/mongo.ts'

import { loadConfig } from '#/config.ts'
import { mediaDependencies, resetDatabase } from '#/database.ts'

const config = loadConfig()
const client = await connectMongo(config.MONGODB_URI)
try {
  await resetDatabase(client.db(config.MONGODB_DB), mediaDependencies(config.MEDIA_DIR))
  console.info(`Base ${config.MONGODB_DB} recréée avec les fixtures.`)
} finally {
  await client.close()
}
