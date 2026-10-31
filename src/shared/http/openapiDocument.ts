import type { OpenAPIHono } from '@hono/zod-openapi'

const DESCRIPTION = `API de test commune aux boilerplates front (Next, Nuxt, SvelteKit, Symfony Twig, HTML).
Implémentation Hono, zod et MongoDB, interchangeable avec boilerplate-api-platform : mêmes chemins, mêmes paramètres, mêmes formes JSON.
Format : JSON simple (\`application/json\`).
En dev et en test, l'en-tête \`X-Scenario: error\` renvoie une 500 et \`X-Scenario: empty\` une collection vide.`

export const openApiDocument = (app: OpenAPIHono) =>
  app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'API de test Kewin', description: DESCRIPTION, version: '1.0.0' },
    servers: [{ url: '/', description: '' }],
  })
