import { switchDefaultLocale, translated } from '#/shared/domain/translations.ts'

import type { Translations, TranslationsInput } from '#/shared/domain/translations.ts'

/**
 * Pages fixes des fronts dont l'admin règle le référencement (SPEC-COMMUNE, section 26, ADR 0010),
 * dans l'ordre du contrat ; la clé est celle du contrat. Même liste et mêmes libellés que MetaPage
 * de l'API Platform.
 */
export const META_PAGES = [
  ['home', 'Accueil'],
  ['catalog', 'Catalogue'],
  ['blog', 'Blog'],
  ['contact', 'Contact'],
  ['sitemap', 'Plan du site'],
  ['legal-notice', 'Mentions légales'],
  ['privacy', 'Données personnelles'],
  ['accessibility', 'Accessibilité'],
] as const

export declare namespace PageMeta {
  type Page = (typeof META_PAGES)[number][0]

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
  META_PAGES.some(([page]) => page === value)

export const metaPageLabel = (page: PageMeta.Page): string =>
  META_PAGES.find(([key]) => key === page)?.[1] ?? page

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
