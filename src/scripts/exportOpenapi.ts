import { writeFile } from 'node:fs/promises'

import { openApiDocument } from '#/shared/http/openapiDocument.ts'

import { createApp } from '#/app.ts'

import type { AppDependencies } from '#/app.ts'

const unavailable = (): Promise<never> =>
  Promise.reject(new Error("L'export OpenAPI n'accède pas à la base."))

const offline: AppDependencies = {
  tasks: { findAll: unavailable },
  articles: { findLatestFirst: unavailable },
  contactMessages: { save: unavailable },
  categories: { findAll: unavailable },
  products: { search: unavailable },
  slides: { findInOrder: unavailable },
  legalPages: { findBySlug: unavailable },
}

const output = process.argv[2] ?? 'openapi.json'
const app = createApp(offline, { APP_ENV: 'prod', CORS_ALLOW_ORIGIN: '^$' })
await writeFile(output, `${JSON.stringify(openApiDocument(app), null, 4)}\n`)
console.info(`Schéma OpenAPI exporté dans ${output}`)
