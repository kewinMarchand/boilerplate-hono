import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { negotiateFormat } from '#/shared/http/contentNegotiation.ts'
import { errorSchema, problemContent } from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { fileName } from '#/media/domain/imageRules.ts'
import { darkPalette, lightPalette } from '#/site/domain/brandPalette.ts'
import { DEFAULT_SITE_IDENTITY, siteIdentityIn } from '#/site/domain/SiteIdentity.ts'
import { getSiteIdentity } from '#/site/application/siteIdentity.ts'
import { mediaUrl, toImageView } from '#/media/http/imageContract.ts'

import { siteIdentityContract } from './contract.ts'

import type { Media } from '#/media/domain/Media.ts'
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

/** Favicons du contrat (ADR 0011), null sans icône. */
const toSiteIcon = (icon: Media.Image | null, options: RouteOptions) => {
  if (icon === null) {
    return null
  }
  const url = (width: number) => mediaUrl(options.mediaBaseUrl, fileName(icon.key, width, 'png'))
  return { png32: url(32), png180: url(180), png192: url(192), png512: url(512) }
}

/**
 * Ressource du contrat : les jetons clair et sombre sont calculés à la lecture, null sans couleurs
 * saisies. L'adresse qui reçoit les messages reste privée. Nom et accroche dans la langue demandée,
 * `locales` : langues activées pour la requête.
 */
const toView = (
  identity: SiteIdentity.Entity,
  options: RouteOptions,
  locale: string | null,
  locales: readonly string[],
) => {
  const { name, tagline, logo, colors, defaultColorScheme, shareImage, icon, salesEnabled } =
    siteIdentityIn(identity, locale)
  return {
    name,
    tagline,
    logo: toImageView(options.mediaBaseUrl, logo, 'logo'),
    shareImage: toImageView(options.mediaBaseUrl, shareImage, 'share'),
    icon: toSiteIcon(icon, options),
    defaultColorScheme,
    salesEnabled,
    theme:
      colors === null
        ? null
        : {
            light: themeTokens(lightPalette(colors.primary, colors.secondary)),
            dark: themeTokens(darkPalette(colors.primary, colors.secondary)),
          },
    locales: [...locales],
  }
}

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
        scenario(options.scenarios, () =>
          toView(DEFAULT_SITE_IDENTITY, options, null, DEFAULT_SITE_IDENTITY.locales),
        ),
      ],
      responses: {
        200: {
          description: 'SiteIdentity resource',
          content: { 'application/json': { schema: siteIdentityContract } },
        },
        404: { description: 'Not found', content: problemContent(errorSchema) },
      },
    }),
    async (c) => {
      const { current, locales } = await options.contentLocale(c.req.raw)
      return c.json(toView(await getSiteIdentity(dependencies), options, current, locales), 200)
    },
  )
