import type { Media } from '#/media/domain/Media.ts'

export declare namespace Article {
  interface Entity {
    readonly id: number
    readonly slug: string
    readonly title: string
    readonly excerpt: string
    /** Date de publication, sans heure : AAAA-MM-JJ. */
    readonly publishedAt: string
    /** Image envoyée par l'admin (ADR 0002), null pour un article d'avant l'envoi des images. */
    readonly image: Media.Image | null
    /** Texte de la fiche, en Markdown saisi dans l'admin. */
    readonly body: string
    /** Texte converti à l'enregistrement (Renderer), servi par la fiche. */
    readonly html: string
  }

  interface Repository {
    findLatestFirst(): Promise<Entity[]>
    findBySlug(slug: string): Promise<Entity | null>
  }

  /** Markdown de la fiche en HTML, avec les réglages des pages légales. */
  interface Renderer {
    render(markdown: string): string
  }

  /** Saisie d'un article dans l'admin. */
  interface Input {
    readonly slug: string
    readonly title: string
    readonly excerpt: string
    /** AAAA-MM-JJ. */
    readonly publishedAt: string
    /** Contenu du fichier envoyé, null pour garder l'image actuelle. */
    readonly imageContent: Uint8Array | null
    readonly imageAlt: string
    readonly imageDecorative: boolean
    /** Markdown. */
    readonly body: string
  }

  /** Article enregistré par l'admin, image résolue. */
  interface Saved {
    readonly slug: string
    readonly title: string
    readonly excerpt: string
    readonly publishedAt: string
    readonly image: Media.Image
    readonly body: string
    readonly html: string
  }

  /** Lectures et écritures de l'admin sur les articles. */
  interface Writer {
    findById(id: number): Promise<Entity | null>
    findBySlug(slug: string): Promise<Entity | null>
    create(article: Saved): Promise<Entity>
    update(id: number, article: Saved): Promise<void>
    remove(id: number): Promise<void>
  }
}

/** Règle du blog refusée : le message est montré tel quel dans l'admin. */
export class BlogRuleViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlogRuleViolation'
  }
}
