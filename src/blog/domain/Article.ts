import type { Media } from '#/media/domain/Media.ts'

/** Les deux listes qui classent les articles (ADR 0009) : la rubrique (sujet) et le format (forme du contenu). */
export const TERM_KINDS = ['section', 'format'] as const

/** Longueur maximale de l'intervenant d'un article (ADR 0009). */
export const SPEAKER_MAX_LENGTH = 80

export declare namespace Article {
  type TermKind = (typeof TERM_KINDS)[number]

  /** Rubrique ou format : slug unique dans sa liste, nom, position. */
  interface Term {
    readonly id: number
    readonly kind: TermKind
    readonly slug: string
    readonly name: string
    readonly position: number
  }

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
    readonly section: Term | null
    readonly format: Term | null
    /** Fichier audio (ADR 0009), null sans fichier. */
    readonly audio: Media.Audio | null
    /** « Présenté par … », vide sans intervenant. */
    readonly speaker: string
    /** Référencement de la fiche (SPEC-COMMUNE, section 26), vide tant que l'admin n'en a pas saisi. */
    readonly metaTitle: string
    readonly metaDescription: string
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
    readonly sectionId: number | null
    readonly formatId: number | null
    /** Contenu du fichier audio envoyé, null pour garder l'audio actuel. */
    readonly audioContent: Uint8Array | null
    /** Retire l'audio actuel ; un fichier envoyé en même temps est ignoré. */
    readonly removeAudio: boolean
    readonly speaker: string
    readonly metaTitle: string
    readonly metaDescription: string
  }

  /** Article enregistré par l'admin, image, termes et audio résolus. */
  interface Saved {
    readonly slug: string
    readonly title: string
    readonly excerpt: string
    readonly publishedAt: string
    readonly image: Media.Image
    readonly body: string
    readonly html: string
    readonly sectionId: number | null
    readonly formatId: number | null
    readonly audio: Media.Audio | null
    readonly speaker: string
    readonly metaTitle: string
    readonly metaDescription: string
  }

  /** Lectures et écritures de l'admin sur les articles. */
  interface Writer {
    findById(id: number): Promise<Entity | null>
    findBySlug(slug: string): Promise<Entity | null>
    create(article: Saved): Promise<Entity>
    update(id: number, article: Saved): Promise<void>
    remove(id: number): Promise<void>
  }

  /** Saisie d'une rubrique ou d'un format ; la forme (slug, longueurs) est validée à la frontière. */
  interface TermInput {
    readonly slug: string
    readonly name: string
    readonly position: number
  }

  interface TermRepository {
    /** Par position, puis par nom. */
    findByKind(kind: TermKind): Promise<Term[]>
    findById(id: number): Promise<Term | null>
    findBySlug(kind: TermKind, slug: string): Promise<Term | null>
    create(kind: TermKind, term: TermInput): Promise<Term>
    update(id: number, term: TermInput): Promise<void>
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

/** Messages accordés à la sorte du terme, comme ArticleTermKind de l'API Platform. */
export const termUsedBy = (kind: Article.TermKind, name: string, articles: number): string => {
  const count = `${articles} ${articles === 1 ? 'article' : 'articles'}`
  return kind === 'section'
    ? `La rubrique ${name} est utilisée par ${count}.`
    : `Le format ${name} est utilisé par ${count}.`
}

export const termSlugTaken = (kind: Article.TermKind, slug: string): string =>
  kind === 'section'
    ? `Le slug « ${slug} » est déjà pris par une autre rubrique.`
    : `Le slug « ${slug} » est déjà pris par un autre format.`

export const termMissing = (kind: Article.TermKind): string =>
  kind === 'section' ? "Cette rubrique n'existe plus." : "Ce format n'existe plus."

/** Intervenant enregistré : sans blancs de début ni de fin, 80 caractères au plus. */
export const speakerOf = (speaker: string): string => {
  const trimmed = speaker.trim()
  if (Array.from(trimmed).length > SPEAKER_MAX_LENGTH) {
    throw new BlogRuleViolation(`L'intervenant compte ${SPEAKER_MAX_LENGTH} caractères au plus.`)
  }
  return trimmed
}
