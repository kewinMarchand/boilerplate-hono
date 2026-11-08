import { writeFile } from 'node:fs/promises'

import { openApiDocument } from '#/shared/http/openapiDocument.ts'

import { createApp } from '#/app.ts'

import type { AppDependencies } from '#/app.ts'

const unavailable = (): Promise<never> =>
  Promise.reject(new Error("L'export OpenAPI n'accède pas à la base."))

const offline: AppDependencies = {
  tasks: { findAll: unavailable },
  articles: { findLatestFirst: unavailable, findBySlug: unavailable },
  contactMessages: { save: unavailable },
  categories: { findAll: unavailable },
  products: { search: unavailable, findBySlug: unavailable, findFeatured: unavailable },
  legalPages: { findBySlug: unavailable },
  adminUsers: { findByEmail: unavailable, save: unavailable },
  passwordHasher: { hash: unavailable, verify: unavailable },
  categoryWriter: { create: unavailable, update: unavailable, remove: unavailable },
  productWriter: {
    findById: unavailable,
    findBySlug: unavailable,
    findAll: unavailable,
    countInCategory: unavailable,
    create: unavailable,
    update: unavailable,
    remove: unavailable,
    moveCategory: unavailable,
  },
  articleWriter: {
    findById: unavailable,
    findBySlug: unavailable,
    create: unavailable,
    update: unavailable,
    remove: unavailable,
  },
  legalPageWriter: { findAll: unavailable, findEditable: unavailable, update: unavailable },
  legalPageRenderer: { split: () => ({ introduction: '', sections: [] }) },
  articleRenderer: { render: () => '' },
  siteIdentities: { find: unavailable, save: unavailable },
  media: {
    encoder: { inspect: unavailable, variants: unavailable },
    storage: { has: unavailable, put: unavailable },
    fingerprint: () => '',
  },
}

const output = process.argv[2] ?? 'openapi.json'
const app = createApp(offline, {
  APP_ENV: 'prod',
  CORS_ALLOW_ORIGIN: '^$',
  ADMIN_SESSION_SECRET: 'export-openapi-sans-session-ni-admin-utilisable',
  MEDIA_BASE_URL: 'http://localhost:8091',
  MEDIA_DIR: 'var/media',
})
await writeFile(output, `${JSON.stringify(openApiDocument(app), null, 4)}\n`)
console.info(`Schéma OpenAPI exporté dans ${output}`)
