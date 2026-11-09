import { RuleViolation } from '#/shared/domain/ruleViolation.ts'
import { switchDefaultLocale, translated } from '#/shared/domain/translations.ts'

import type { Media } from '#/media/domain/Media.ts'
import type { Translations, TranslationsInput } from '#/shared/domain/translations.ts'

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
    /** Nom et slug dans les autres langues (ADR 0014). */
    readonly translations: Translations
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
    /**
     * Slug, titre, chapô, texte (Markdown), intervenant, métadonnées et texte de remplacement de
     * l'image dans les autres langues (ADR 0014). Le HTML d'un texte traduit est rendu à la lecture.
     */
    readonly translations: Translations
  }

  interface Repository {
    findLatestFirst(): Promise<Entity[]>
    /**
     * `locale` : langue du slug (le sien, ou celui de la langue par défaut s'il n'est pas traduit) ;
     * null ou absent : la langue par défaut.
     */
    findBySlug(slug: string, locale?: string | null): Promise<Entity | null>
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
    /** Absent : les traductions actuelles sont gardées. */
    readonly translations?: TranslationsInput
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
    readonly translations: Translations
  }

  /** Lectures et écritures de l'admin sur les articles. */
  interface Writer {
    findById(id: number): Promise<Entity | null>
    /** `locale` : langue du slug ; null ou absent : la langue par défaut. */
    findBySlug(slug: string, locale?: string | null): Promise<Entity | null>
    create(article: Saved): Promise<Entity>
    update(id: number, article: Saved): Promise<void>
    remove(id: number): Promise<void>
  }

  /** Saisie d'une rubrique ou d'un format ; la forme (slug, longueurs) est validée à la frontière. */
  interface TermInput {
    readonly slug: string
    readonly name: string
    readonly position: number
    /** Absent : les traductions actuelles sont gardées. */
    readonly translations?: TranslationsInput
  }

  /** Rubrique ou format enregistré. */
  interface TermSaved extends Omit<TermInput, 'translations'> {
    readonly translations: Translations
  }

  interface TermRepository {
    /** Par position, puis par nom. */
    findByKind(kind: TermKind): Promise<Term[]>
    findById(id: number): Promise<Term | null>
    /** `locale` : langue du slug ; null ou absent : la langue par défaut. */
    findBySlug(kind: TermKind, slug: string, locale?: string | null): Promise<Term | null>
    create(kind: TermKind, term: TermSaved): Promise<Term>
    update(id: number, term: TermSaved): Promise<void>
    remove(id: number): Promise<void>
  }
}

/** Règle du blog refusée : le message s'affiche dans l'admin, traduit dans la langue de son interface. */
export class BlogRuleViolation extends RuleViolation {
  constructor(template: string, parameters: Readonly<Record<string, string | number>> = {}) {
    super(template, parameters)
    this.name = 'BlogRuleViolation'
  }
}

/** Messages accordés à la sorte du terme, comme ArticleTermKind de l'API Platform. */
export const termUsedBy = (
  kind: Article.TermKind,
  name: string,
  articles: number,
): BlogRuleViolation => {
  const template =
    kind === 'section'
      ? articles === 1
        ? 'La rubrique %name% est utilisée par 1 article.'
        : 'La rubrique %name% est utilisée par %count% articles.'
      : articles === 1
        ? 'Le format %name% est utilisé par 1 article.'
        : 'Le format %name% est utilisé par %count% articles.'
  return new BlogRuleViolation(template, { name, count: articles })
}

export const termSlugTaken = (kind: Article.TermKind, slug: string): BlogRuleViolation =>
  new BlogRuleViolation(
    kind === 'section'
      ? 'Le slug « %slug% » est déjà pris par une autre rubrique.'
      : 'Le slug « %slug% » est déjà pris par un autre format.',
    { slug },
  )

export const termMissing = (kind: Article.TermKind): BlogRuleViolation =>
  new BlogRuleViolation(
    kind === 'section' ? "Cette rubrique n'existe plus." : "Ce format n'existe plus.",
  )

/** Intervenant enregistré : sans blancs de début ni de fin, 80 caractères au plus. */
export const speakerOf = (speaker: string): string => {
  const trimmed = speaker.trim()
  if (Array.from(trimmed).length > SPEAKER_MAX_LENGTH) {
    throw new BlogRuleViolation("L'intervenant compte %max% caractères au plus.", {
      max: SPEAKER_MAX_LENGTH,
    })
  }
  return trimmed
}

/** Rubrique ou format dans une langue (ADR 0014) ; locale null : la langue par défaut. */
export const termIn = (term: Article.Term, locale: string | null): Article.Term => ({
  ...term,
  slug: translated(term.translations, 'slug', term.slug, locale),
  name: translated(term.translations, 'name', term.name, locale),
})

type ArticleText =
  'slug' | 'title' | 'excerpt' | 'body' | 'speaker' | 'metaTitle' | 'metaDescription'

const ARTICLE_TEXTS: readonly ArticleText[] = [
  'slug',
  'title',
  'excerpt',
  'body',
  'speaker',
  'metaTitle',
  'metaDescription',
]

/**
 * Article dans une langue (ADR 0014), rubrique et format compris : chaque champ traduisible prend
 * sa traduction, ou la valeur de la langue par défaut. Une image décorative le reste. `html` reste
 * celui de la langue par défaut : l'appelant rend le texte traduit.
 */
export const articleIn = (article: Article.Entity, locale: string | null): Article.Entity => ({
  ...article,
  ...Object.fromEntries(
    ARTICLE_TEXTS.map((field) => [
      field,
      translated(article.translations, field, article[field], locale),
    ]),
  ),
  image:
    article.image === null || article.image.alt === ''
      ? article.image
      : {
          ...article.image,
          alt: translated(article.translations, 'imageAlt', article.image.alt, locale),
        },
  section: article.section === null ? null : termIn(article.section, locale),
  format: article.format === null ? null : termIn(article.format, locale),
})

/** Le texte de l'article est-il traduit dans cette langue ? Sinon son HTML enregistré sert. */
export const hasTranslatedBody = (article: Article.Entity, locale: string | null): boolean =>
  locale !== null && article.translations[locale]?.['body'] !== undefined

/** Nouvelle langue par défaut (ADR 0014) : les traductions de `to` passent dans les champs. */
export const switchTermLocale = (term: Article.Term, from: string, to: string): Article.Term => {
  const { texts, translations } = switchDefaultLocale(
    { slug: term.slug, name: term.name },
    term.translations,
    from,
    to,
  )
  return { ...term, ...texts, translations }
}

export const switchArticleLocale = (
  article: Article.Entity,
  from: string,
  to: string,
): Article.Entity => {
  const { texts, translations } = switchDefaultLocale(
    {
      ...Object.fromEntries(ARTICLE_TEXTS.map((field) => [field, article[field]])),
      imageAlt: article.image?.alt ?? '',
    },
    article.translations,
    from,
    to,
  )
  const { imageAlt, ...fields } = texts

  return {
    ...article,
    ...fields,
    image: article.image === null ? null : { ...article.image, alt: imageAlt },
    translations,
  }
}
