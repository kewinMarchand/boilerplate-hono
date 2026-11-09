import { switchDefaultLocale, translated } from '#/shared/domain/translations.ts'

import type { Translations, TranslationsInput } from '#/shared/domain/translations.ts'

/**
 * Pages fixes des fronts dont l'admin règle le référencement (SPEC-COMMUNE, section 26, ADR 0010),
 * dans l'ordre du contrat ; la clé est celle du contrat, comme MetaPage de l'API Platform. Leurs
 * libellés sont ceux de l'interface de l'admin (ADR 0014).
 */
export const META_PAGES = [
  'home',
  'catalog',
  'blog',
  'contact',
  'sitemap',
  'legal-notice',
  'privacy',
  'accessibility',
] as const

export declare namespace PageMeta {
  type Page = (typeof META_PAGES)[number]

  /** Titre et description d'une page fixe, vides tant que l'admin n'en a pas saisi : le front garde alors les siens. */
  interface Entity {
    readonly page: Page
    readonly title: string
    readonly description: string
    /** Titre et description dans les autres langues (ADR 0014). */
    readonly translations: Translations
  }

  interface Repository {
    /** Pages enregistrées, dans un ordre quelconque. */
    findAll(): Promise<Entity[]>
  }

  /** Saisie de l'admin ; les longueurs sont validées à la frontière. */
  interface Input {
    readonly title: string
    readonly description: string
    /** Absent : les traductions actuelles sont gardées. */
    readonly translations?: TranslationsInput
  }

  /** Modification seule : les pages fixes existent toujours (fixtures). */
  interface Writer extends Repository {
    find(page: Page): Promise<Entity | null>
    update(page: Page, meta: Omit<Entity, 'page'>): Promise<void>
  }
}

export const isMetaPage = (value: string): value is PageMeta.Page =>
  META_PAGES.some((page) => page === value)

/** Titre et description dans une langue (ADR 0014) ; locale null : la langue par défaut. */
export const pageMetaIn = (meta: PageMeta.Entity, locale: string | null): PageMeta.Entity => ({
  ...meta,
  title: translated(meta.translations, 'title', meta.title, locale),
  description: translated(meta.translations, 'description', meta.description, locale),
})

/** Nouvelle langue par défaut (ADR 0014) : les traductions de `to` passent dans les champs. */
export const switchPageMetaLocale = (
  meta: PageMeta.Entity,
  from: string,
  to: string,
): PageMeta.Entity => {
  const { texts, translations } = switchDefaultLocale(
    { title: meta.title, description: meta.description },
    meta.translations,
    from,
    to,
  )
  return { ...meta, ...texts, translations }
}
