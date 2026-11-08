import type { Media } from '#/media/domain/Media.ts'

/** Identité du site, une seule par API (section 22 de SPEC-COMMUNE, ADR 0005), même vocabulaire que l'API Platform. */
export declare namespace SiteIdentity {
  /** Thème servi tant que le visiteur n'a rien choisi (SPEC-COMMUNE, section 20). auto : celui du système. */
  type ColorScheme = 'auto' | 'light' | 'dark'

  /** Les deux couleurs de marque saisies, en #rrggbb minuscules (brandColors). */
  interface Colors {
    readonly primary: string
    readonly secondary: string
  }

  /**
   * Sans couleurs de marque (null), les fronts gardent les jetons de boilerplates-ui ; sans icône
   * (favicons, ADR 0011) ni image de partage (ADR 0010), leurs propres fichiers.
   */
  interface Entity {
    readonly name: string
    readonly tagline: string
    readonly logo: Media.Image | null
    readonly colors: Colors | null
    readonly defaultColorScheme: ColorScheme
    readonly shareImage: Media.Image | null
    /** Décorative : les favicons n'ont pas de texte de remplacement. */
    readonly icon: Media.Image | null
    /** Faux : ni prix ni panier sur les fronts, une demande de renseignement par produit (SPEC-COMMUNE, section 27). */
    readonly salesEnabled: boolean
    /** Adresse qui reçoit les messages du formulaire de contact. Privée : absente du contrat. */
    readonly contactRecipient: string
  }

  interface Repository {
    /** L'identité enregistrée, ou null tant que l'admin ne l'a jamais modifiée. */
    find(): Promise<Entity | null>
    save(identity: Entity): Promise<void>
  }

  /** Saisie de l'admin. La forme (longueurs, thème) est validée à la frontière. */
  interface Input {
    readonly name: string
    readonly tagline: string
    /** Pas de couleurs de marque : les fronts gardent les jetons de boilerplates-ui ; les couleurs saisies sont ignorées. */
    readonly useLibraryColors: boolean
    /** #rrggbb. */
    readonly primaryColor: string
    /** #rrggbb. */
    readonly secondaryColor: string
    readonly defaultColorScheme: ColorScheme
    /** Contenu du logo envoyé, null pour garder le logo actuel. */
    readonly imageContent: Uint8Array | null
    /** Vide : le nom du site. */
    readonly imageAlt: string
    /** Retire le logo actuel ; un fichier envoyé en même temps est ignoré. */
    readonly removeLogo: boolean
    /** Contenu de l'image de partage envoyée, null pour garder l'actuelle. */
    readonly shareImageContent: Uint8Array | null
    /** Vide : le nom du site. */
    readonly shareImageAlt: string
    readonly removeShareImage: boolean
    /** Contenu de l'icône envoyée, null pour garder l'actuelle. */
    readonly iconContent: Uint8Array | null
    readonly removeIcon: boolean
    readonly salesEnabled: boolean
    readonly contactRecipient: string
  }
}

export const COLOR_SCHEMES: readonly SiteIdentity.ColorScheme[] = ['auto', 'light', 'dark']

/** Valeurs du modèle : celles des fixtures, et celles servies tant que l'admin n'a rien enregistré. */
export const DEFAULT_SITE_IDENTITY: SiteIdentity.Entity = {
  name: 'Boilerplate',
  tagline: 'Modèle de site avec boilerplates-ui, outillé pour la QA et les tests end-to-end.',
  logo: null,
  colors: null,
  defaultColorScheme: 'auto',
  shareImage: null,
  icon: null,
  salesEnabled: true,
  contactRecipient: 'contact@example.com',
}

/** Une modification de l'identité du site enfreint une de ses règles. Le message s'affiche tel quel dans l'admin. */
export class SiteRuleViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SiteRuleViolation'
  }
}
