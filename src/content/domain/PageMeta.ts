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
  }

  interface Repository {
    /** Pages enregistrées, dans un ordre quelconque. */
    findAll(): Promise<Entity[]>
  }

  /** Saisie de l'admin ; les longueurs sont validées à la frontière. */
  interface Input {
    readonly title: string
    readonly description: string
  }

  /** Modification seule : les pages fixes existent toujours (fixtures). */
  interface Writer extends Repository {
    find(page: Page): Promise<Entity | null>
    update(page: Page, meta: Input): Promise<void>
  }
}

export const isMetaPage = (value: string): value is PageMeta.Page =>
  META_PAGES.some(([page]) => page === value)

export const metaPageLabel = (page: PageMeta.Page): string =>
  META_PAGES.find(([key]) => key === page)?.[1] ?? page
