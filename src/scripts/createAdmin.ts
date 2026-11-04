import { text } from 'node:stream/consumers'

import { connectMongo } from '#/shared/infrastructure/mongo.ts'

import { InvalidEmailError, PasswordTooShortError } from '#/admin/domain/AdminUser.ts'
import { saveAdmin } from '#/admin/application/adminAccounts.ts'

import { loadConfig } from '#/config.ts'
import { createRepositories, ensureSchema } from '#/database.ts'

/**
 * Crée un compte de l'admin, ou change son mot de passe : `make admin EMAIL=…`, qui lit le mot de
 * passe sans l'afficher et le passe sur l'entrée standard (jamais en argument, visible dans `ps`).
 */
const email = process.argv[2] ?? ''
const password = (await text(process.stdin)).replace(/\r?\n$/, '')

const config = loadConfig()
const client = await connectMongo(config.MONGODB_URI)
try {
  const db = client.db(config.MONGODB_DB)
  await ensureSchema(db)
  const user = await saveAdmin(createRepositories(db), email, password)
  console.info(`Compte d'administration prêt : ${user.email}`)
} catch (error) {
  if (error instanceof InvalidEmailError || error instanceof PasswordTooShortError) {
    console.error(error.message)
    process.exitCode = 1
  } else {
    throw error
  }
} finally {
  await client.close()
}
