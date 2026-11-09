import { writeFile } from 'node:fs/promises'

import { openApiDocument } from '#/shared/http/openapiDocument.ts'

import { createApp } from '#/app.ts'

import type { AppDependencies } from '#/app.ts'

const unavailable = (): Promise<never> =>
  Promise.reject(new Error("L'export OpenAPI n'accède pas à la base."))

const offline: AppDependencies = {
  tasks: { findAll: unavailable },
  articles: { findLatestFirst: unavailable, findBySlug: unavailable },
  contactMessages: { save: unavailable, findLatestFirst: unavailable, find: unavailable },
  contactProducts: { find: unavailable },
  contactRecipient: { address: unavailable },
  mailer: { send: unavailable },
  categories: { findAll: unavailable },
  products: { search: unavailable, findBySlug: unavailable, findFeatured: unavailable },
  legalPages: { findBySlug: unavailable },
  adminUsers: { findByEmail: unavailable, save: unavailable },
  passwordHasher: { hash: unavailable, verify: unavailable },
  categoryWriter: {
    create: unavailable,
    update: unavailable,
    remove: unavailable,
    replaceAll: unavailable,
  },
  productWriter: {
    findById: unavailable,
    findBySlug: unavailable,
    findAll: unavailable,
    countInCategory: unavailable,
    create: unavailable,
    update: unavailable,
    remove: unavailable,
    moveCategory: unavailable,
    removeAttributeValue: unavailable,
    replaceAll: unavailable,
  },
  attributes: { findAll: unavailable },
  attributeWriter: {
    findByCode: unavailable,
    create: unavailable,
    update: unavailable,
    remove: unavailable,
  },
  articleWriter: {
    findById: unavailable,
    findBySlug: unavailable,
    create: unavailable,
    update: unavailable,
    remove: unavailable,
    replaceAll: unavailable,
  },
  legalPageWriter: { findAll: unavailable, findEditable: unavailable, update: unavailable },
  legalPageRenderer: { split: () => ({ introduction: '', sections: [] }) },
  pageMetas: { findAll: unavailable },
  pageMetaWriter: { findAll: unavailable, find: unavailable, update: unavailable },
  articleRenderer: { render: () => '' },
  articleTerms: {
    findByKind: unavailable,
    findById: unavailable,
    findBySlug: unavailable,
    create: unavailable,
    update: unavailable,
    remove: unavailable,
    replaceAll: unavailable,
  },
  siteIdentities: { find: unavailable, save: unavailable },
  switchContentLocale: unavailable,
  media: {
    encoder: { inspect: unavailable, variants: unavailable },
    audioInspector: { inspect: () => null },
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
