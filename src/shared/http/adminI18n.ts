import { AsyncLocalStorage } from 'node:async_hooks'
import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'

import { fillTemplate, RuleViolation } from '#/shared/domain/ruleViolation.ts'

import { en } from './adminMessages/en.ts'
import { fr } from './adminMessages/fr.ts'
import { VIOLATIONS_EN } from './adminMessages/violations.en.ts'

/**
 * Langue de l'interface de l'admin (SPEC-COMMUNE, section 29, ADR 0014), indépendante des langues du
 * contenu : français par défaut, anglais au choix, mémorisée par un cookie. Tous les libellés passent
 * par `t` et les dictionnaires `adminMessages/` ; aucun libellé n'est écrit dans les pages.
 */
export const ADMIN_LOCALES = ['fr', 'en'] as const
export type AdminLocale = (typeof ADMIN_LOCALES)[number]
export type MessageKey = keyof typeof fr

/** Paramètre d'adresse du sélecteur de langue, comme `_locale` d'EasyAdmin. */
export const LOCALE_QUERY = '_locale'
const COOKIE = 'admin_locale'
const ONE_YEAR = 365 * 24 * 60 * 60

const DICTIONARIES: Readonly<Record<AdminLocale, Readonly<Record<MessageKey, string>>>> = { fr, en }

/** Nom de chaque langue de l'interface, écrit dans sa propre langue. */
export const ADMIN_LOCALE_NAMES: Readonly<Record<AdminLocale, string>> = {
  fr: 'Français',
  en: 'English',
}

/** Langue de l'interface et chemin de la page demandée (liens du sélecteur de langue). */
const storage = new AsyncLocalStorage<{ readonly locale: AdminLocale; readonly path: string }>()

const isAdminLocale = (value: string | undefined): value is AdminLocale =>
  ADMIN_LOCALES.some((locale) => locale === value)

/** Langue de l'interface pour la requête en cours ; le français hors requête (tests unitaires). */
export const adminLocale = (): AdminLocale => storage.getStore()?.locale ?? 'fr'

/** Chemin de la page demandée, sans paramètres. */
export const adminPath = (): string => storage.getStore()?.path ?? '/admin'

/** Libellé de l'interface dans sa langue, paramètres `%nom%` remplacés. */
export const t = (key: MessageKey, parameters: Readonly<Record<string, string | number>> = {}) =>
  fillTemplate(DICTIONARIES[adminLocale()][key], parameters)

/**
 * Règle du domaine refusée, dans la langue de l'interface : son modèle français sert de clé (comme
 * le domaine « violations » de l'API Platform) ; un modèle sans traduction reste en français.
 */
export const violationMessage = (violation: RuleViolation): string =>
  adminLocale() === 'en'
    ? fillTemplate(VIOLATIONS_EN[violation.template] ?? violation.template, violation.parameters)
    : violation.message

/** Règle refusée : son message dans la langue de l'interface, à montrer dans la page ; toute autre erreur remonte (500). */
export const refusalMessage = (error: unknown): string => {
  if (error instanceof RuleViolation) {
    return violationMessage(error)
  }
  throw error
}

/**
 * Choix de la langue : `?_locale=` (sélecteur) l'emporte et se mémorise, sinon le cookie, sinon le
 * français. Toute la requête s'exécute dans cette langue.
 */
export const adminLanguage = () =>
  createMiddleware(async (c, next) => {
    const requested = c.req.query(LOCALE_QUERY)
    const remembered = getCookie(c, COOKIE)
    const locale: AdminLocale = isAdminLocale(requested)
      ? requested
      : isAdminLocale(remembered)
        ? remembered
        : 'fr'
    if (isAdminLocale(requested)) {
      setCookie(c, COOKIE, requested, {
        path: '/admin',
        httpOnly: true,
        sameSite: 'Strict',
        secure: new URL(c.req.url).protocol === 'https:',
        maxAge: ONE_YEAR,
      })
    }
    await storage.run({ locale, path: c.req.path }, next)
  })
