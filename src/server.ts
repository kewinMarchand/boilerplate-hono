import { serve } from '@hono/node-server'

import { initErrorReporting } from '#/shared/infrastructure/errorReporting.ts'
import { connectMongo } from '#/shared/infrastructure/mongo.ts'

import { nodemailerMailer, smtpTransport } from '#/contact/infrastructure/nodemailerMailer.ts'

import { createApp } from '#/app.ts'
import { loadConfig } from '#/config.ts'
import { createRepositories, ensureSchema, mediaDependencies } from '#/database.ts'

const config = loadConfig()
const reporter = initErrorReporting(config)
const client = await connectMongo(config.MONGODB_URI)
const db = client.db(config.MONGODB_DB)
await ensureSchema(db)
const mailer = nodemailerMailer(smtpTransport(config.MAILER_DSN), config.MAILER_FROM)

const server = serve(
  {
    fetch: createApp(
      { ...createRepositories(db, mediaDependencies(config.MEDIA_DIR)), mailer },
      config,
      reporter,
    ).fetch,
    port: config.PORT,
  },
  (info) => {
    console.info(`API (${config.APP_ENV}) sur le port ${info.port}, base ${config.MONGODB_DB}`)
  },
)

const shutdown = (): void => {
  server.close(() => {
    void client.close().then(() => process.exit(0))
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
