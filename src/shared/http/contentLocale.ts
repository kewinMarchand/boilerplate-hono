import { createMiddleware } from 'hono/factory'

import { parsePhpQuery } from './phpQuery.ts'
import { SCENARIO_HEADER } from './scenario.ts'

/** Paramètre de requête qui choisit la langue du contenu ; il l'emporte sur Accept-Language. */
export const LOCALE_PARAMETER = 'locale'

/** Langue servie avec `X-Scenario: bilingual` (dev et test), en plus des langues activées. */
const BILINGUAL_SCENARIO_LOCALE = 'en'

/** Langue du contenu d'une requête (SPEC-COMMUNE, section 29, ADR 0014). */
export interface RequestLocale {
  /** Langue demandée et activée, ou la langue par défaut. */
  readonly current: string
  /** Langues activées, la langue par défaut en premier. */
  readonly locales: readonly string[]
}

/** Lit la langue d'une requête : langues activées lues une fois par requête. */
export type ContentLocaleResolver = (request: Request) => Promise<RequestLocale>

/** « en-GB » → « en ». */
const language = (tag: string): string =>
  (tag.trim().replaceAll('_', '-').split('-')[0] ?? '').toLowerCase()

const QUALITY = /^q=([01](?:\.\d{0,3})?)$/i

/** Langues d'Accept-Language par poids décroissant, ordre d'écriture à poids égal, sans région, poids nul exclu. */
const acceptedLanguages = (header: string): string[] =>
  header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...pieces] = part.split(';').map((piece) => piece.trim())
      const quality = pieces.reduce((current, piece) => {
        const match = QUALITY.exec(piece)
        return match?.[1] === undefined ? current : Number(match[1])
      }, 1)
      return { tag, quality, index }
    })
    .filter(({ tag, quality }) => tag !== '' && quality > 0)
    .toSorted((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ tag }) => language(tag))

/**
 * Le paramètre l'emporte s'il désigne une langue activée (sans casse ni région) ; sinon la première
 * langue d'Accept-Language qui est activée ; sinon la langue par défaut. Comme ContentLocale de
 * l'API Platform.
 */
export const negotiateLocale = (
  enabled: readonly [string, ...string[]],
  parameter: unknown,
  acceptLanguage: string | undefined,
): string => {
  if (typeof parameter === 'string' && enabled.includes(language(parameter))) {
    return language(parameter)
  }

  return (
    acceptedLanguages(acceptLanguage ?? '').find((locale) => enabled.includes(locale)) ?? enabled[0]
  )
}

/** Réponses de l'API qui portent Content-Language : tout `/api/`, documentation exclue. */
export const isContentPath = (path: string): boolean =>
  path.startsWith('/api/') && !path.startsWith('/api/docs')

/**
 * Résolveur de la langue, mémorisé par requête. `enabledLocales` : langues de l'identité du site.
 * `X-Scenario: bilingual` (scénarios actifs) ajoute l'anglais aux langues activées pour la requête.
 */
export const contentLocaleResolver = (
  enabledLocales: () => Promise<readonly [string, ...string[]]>,
  scenarios: boolean,
): ContentLocaleResolver => {
  const resolved = new WeakMap<Request, Promise<RequestLocale>>()
  const resolve = async (request: Request): Promise<RequestLocale> => {
    const enabled = await enabledLocales()
    const bilingual =
      scenarios &&
      request.headers.get(SCENARIO_HEADER) === 'bilingual' &&
      !enabled.includes(BILINGUAL_SCENARIO_LOCALE)
    const locales: readonly [string, ...string[]] = bilingual
      ? [...enabled, BILINGUAL_SCENARIO_LOCALE]
      : enabled
    const parameter = parsePhpQuery(new URL(request.url).search).get(LOCALE_PARAMETER)

    return {
      current: negotiateLocale(
        locales,
        parameter,
        request.headers.get('Accept-Language') ?? undefined,
      ),
      locales,
    }
  }

  return (request) => {
    const known = resolved.get(request)
    if (known !== undefined) {
      return known
    }
    const locale = resolve(request)
    resolved.set(request, locale)
    return locale
  }
}

/** Content-Language et `Vary: Accept-Language` sur chaque réponse de l'API, documentation exclue. */
export const contentLanguage = (resolve: ContentLocaleResolver) =>
  createMiddleware(async (c, next) => {
    await next()
    if (!isContentPath(c.req.path)) {
      return
    }
    c.res.headers.append('Vary', 'Accept-Language')
    // Langues illisibles (base injoignable) : la réponse, déjà une erreur, part sans Content-Language
    const locale = await resolve(c.req.raw).catch(() => null)
    if (locale !== null) {
      c.res.headers.set('Content-Language', locale.current)
    }
  })

/** Version d'un élément dans une langue : son slug dans cette langue. */
export interface Alternate {
  readonly locale: string
  readonly slug: string
}

/** L'élément dans chaque langue activée, langue demandée comprise ; [] sur un site monolingue. */
export const alternates = (
  { locales }: RequestLocale,
  slugIn: (locale: string) => string,
): Alternate[] =>
  locales.length > 1 ? locales.map((locale) => ({ locale, slug: slugIn(locale) })) : []
