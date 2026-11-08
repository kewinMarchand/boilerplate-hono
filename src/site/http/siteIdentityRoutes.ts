import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { darkPalette, lightPalette } from '#/site/domain/brandPalette.ts'
import { DEFAULT_SITE_IDENTITY } from '#/site/domain/SiteIdentity.ts'
import { getSiteIdentity } from '#/site/application/siteIdentity.ts'
import { toImageView } from '#/media/http/imageContract.ts'

import { siteIdentityContract } from './contract.ts'

import type { RouteOptions } from '#/shared/http/routeOptions.ts'
import type { SiteDependencies } from '#/site/application/siteIdentity.ts'
import type { BrandPalette } from '#/site/domain/brandPalette.ts'
import type { SiteIdentity } from '#/site/domain/SiteIdentity.ts'

const themeTokens = ({ primary, secondary }: BrandPalette) => ({
  primary: primary.color,
  'primary-dark': primary.dark,
  'on-primary': primary.on,
  'primary-surface-subtle': primary.surfaceSubtle,
  'primary-surface': primary.surface,
  'primary-surface-strong': primary.surfaceStrong,
  secondary: secondary.color,
  'secondary-dark': secondary.dark,
  'on-secondary': secondary.on,
  'secondary-surface-subtle': secondary.surfaceSubtle,
  'secondary-surface': secondary.surface,
  'secondary-surface-strong': secondary.surfaceStrong,
})

/** Ressource du contrat : les jetons clair et sombre sont calculés à la lecture, null sans couleurs saisies. */
const toView = (
  { name, tagline, logo, colors, defaultColorScheme }: SiteIdentity.Entity,
  options: RouteOptions,
) => ({
  name,
  tagline,
  logo: toImageView(options.mediaBaseUrl, logo, 'logo'),
  defaultColorScheme,
  theme:
    colors === null
      ? null
      : {
          light: themeTokens(lightPalette(colors.primary, colors.secondary)),
          dark: themeTokens(darkPalette(colors.primary, colors.secondary)),
        },
})

export const siteIdentityRoutes = (
  dependencies: Pick<SiteDependencies, 'siteIdentities'>,
  options: RouteOptions,
) =>
  new OpenAPIHono().openapi(
    createRoute({
      method: 'get',
      path: '/api/site-identity',
      operationId: 'api_site-identity_get',
      tags: ['SiteIdentity'],
      summary: 'Retrieves a SiteIdentity resource.',
      description: 'Retrieves a SiteIdentity resource.',
      // X-Scenario: empty sert l'identité par défaut (celle des fixtures), comme l'API Platform
      middleware: [
        negotiateFormat(),
        scenario(options.scenarios, () => toView(DEFAULT_SITE_IDENTITY, options)),
      ],
      responses: {
        200: {
          description: 'SiteIdentity resource',
          content: { 'application/json': { schema: siteIdentityContract } },
        },
        404: { description: 'Not found', content: problemContent(errorSchema) },
      },
    }),
    async (c) => c.json(toView(await getSiteIdentity(dependencies), options), 200),
  )
