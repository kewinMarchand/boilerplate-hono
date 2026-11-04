export declare namespace Article {
  interface Entity {
    readonly id: number
    readonly slug: string
    readonly title: string
    readonly excerpt: string
    /** Date de publication, sans heure : AAAA-MM-JJ. */
    readonly publishedAt: string
  }

  interface Repository {
    findLatestFirst(): Promise<Entity[]>
  }

  /** Saisie d'un article dans l'admin. */
  interface Input {
    readonly slug: string
    readonly title: string
    readonly excerpt: string
    /** AAAA-MM-JJ. */
    readonly publishedAt: string
  }

  /** Lectures et écritures de l'admin sur les articles. */
  interface Writer {
    findById(id: number): Promise<Entity | null>
    findBySlug(slug: string): Promise<Entity | null>
    create(input: Input): Promise<Entity>
    update(id: number, input: Input): Promise<void>
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
