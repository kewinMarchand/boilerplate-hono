import { LOCALE_PARAMETER } from './contentLocale.ts'

import type { OpenAPIHono } from '@hono/zod-openapi'

const DESCRIPTION = `API de test commune aux boilerplates front (Next, Nuxt, SvelteKit, Symfony Twig, HTML).
Implémentation Hono, zod et MongoDB, interchangeable avec boilerplate-api-platform : mêmes chemins, mêmes paramètres, mêmes formes JSON.
Format : JSON simple (\`application/json\`).
En dev et en test, l'en-tête \`X-Scenario: error\` renvoie une 500 et \`X-Scenario: empty\` une collection vide.`

type OpenApiDocument = ReturnType<OpenAPIHono['getOpenAPI31Document']>

/** Langue du contenu (ADR 0014), documentée une fois ici sur chaque lecture, comme LocaleOpenApiFactory de l'API Platform. */
const LOCALE_PARAMETERS = [
  {
    name: LOCALE_PARAMETER,
    in: 'query',
    description:
      "Langue du contenu, code BCP 47 court (fr, en). L'emporte sur Accept-Language. Langue non activée : ignoré.",
    required: false,
    schema: { type: 'string' },
  },
  {
    name: 'Accept-Language',
    in: 'header',
    description:
      'Langues acceptées : la première langue activée du site qui y figure est servie, sinon la langue par défaut. Champ non traduit : valeur de la langue par défaut.',
    required: false,
    schema: { type: 'string' },
  },
] as const

const CONTENT_LANGUAGE = {
  'Content-Language': { description: 'Langue du contenu servi.', schema: { type: 'string' } },
} as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const withContentLocale = (document: OpenApiDocument): OpenApiDocument => {
  for (const item of Object.values(document.paths ?? {})) {
    const get = item.get
    if (get === undefined) {
      continue
    }
    get.parameters = [...(get.parameters ?? []), ...LOCALE_PARAMETERS]
    const ok: unknown = get.responses?.['200']
    if (isRecord(ok)) {
      ok['headers'] = { ...(isRecord(ok['headers']) ? ok['headers'] : {}), ...CONTENT_LANGUAGE }
    }
  }
  return document
}

export const openApiDocument = (app: OpenAPIHono) =>
  withContentLocale(
    app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'API de test Kewin', description: DESCRIPTION, version: '1.0.0' },
      servers: [{ url: '/', description: '' }],
    }),
  )
