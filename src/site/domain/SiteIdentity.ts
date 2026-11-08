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

  /** Sans couleurs de marque (null), les fronts gardent les jetons de boilerplates-ui. */
  interface Entity {
    readonly name: string
    readonly tagline: string
    readonly logo: Media.Image | null
    readonly colors: Colors | null
    readonly defaultColorScheme: ColorScheme
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
    /** #rrggbb, vide avec la secondaire pour garder les couleurs de boilerplates-ui. */
    readonly primaryColor: string
    /** #rrggbb, vide avec la principale. */
    readonly secondaryColor: string
    readonly defaultColorScheme: ColorScheme
    /** Contenu du logo envoyé, null pour garder le logo actuel. */
    readonly imageContent: Uint8Array | null
    /** Vide : le nom du site. */
    readonly imageAlt: string
    /** Retire le logo actuel ; un fichier envoyé en même temps est ignoré. */
    readonly removeLogo: boolean
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
}

/** Une modification de l'identité du site enfreint une de ses règles. Le message s'affiche tel quel dans l'admin. */
export class SiteRuleViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SiteRuleViolation'
  }
}
