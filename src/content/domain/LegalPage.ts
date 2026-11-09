import { switchDefaultLocale, translated } from '#/shared/domain/translations.ts'

import type { Translations, TranslationsInput } from '#/shared/domain/translations.ts'

export declare namespace LegalPage {
  interface Section {
    readonly title: string
    readonly html: string
  }

  /**
   * HTML découpé à l'enregistrement, depuis le Markdown saisi dans l'admin (Renderer). Le slug est
   * commun aux langues : il est fixé par les routes des fronts.
   */
  interface Entity {
    readonly slug: string
    readonly title: string
    readonly introduction: string
    readonly sections: Section[]
    /** Titre et Markdown dans les autres langues (ADR 0014), rendus à la lecture. */
    readonly translations: Translations
  }

  interface Repository {
    findBySlug(slug: string): Promise<Entity | null>
  }

  /** Saisie d'une page légale dans l'admin. Le slug ne se modifie pas. */
  interface Input {
    readonly title: string
    /** Markdown ; chaque titre de niveau 2 ouvre une section. */
    readonly body: string
    /** Absent : les traductions actuelles sont gardées. */
    readonly translations?: TranslationsInput
  }

  /** Page légale vue par l'admin, avec son Markdown. */
  interface Editable {
    readonly slug: string
    readonly title: string
    readonly body: string
    readonly translations: Translations
  }

  /** Page légale enregistrée : sa saisie, ses traductions et son rendu. */
  interface Saved extends ReturnType<Renderer['split']> {
    readonly title: string
    readonly body: string
    readonly translations: Translations
  }

  /** Lectures et écritures de l'admin sur les pages légales (ni création ni suppression). */
  interface Writer {
    findAll(): Promise<Editable[]>
    findEditable(slug: string): Promise<Editable | null>
    update(slug: string, page: Saved): Promise<void>
  }

  /** Markdown saisi dans l'admin, découpé en introduction et sections HTML. */
  interface Renderer {
    split(body: string): { introduction: string; sections: Section[] }
  }
}

/** Titre dans une langue (ADR 0014) ; locale null : la langue par défaut. */
export const legalPageTitleIn = (page: LegalPage.Entity, locale: string | null): string =>
  translated(page.translations, 'title', page.title, locale)

/** Markdown traduit dans cette langue, ou null : le rendu enregistré sert. */
export const translatedLegalBody = (
  page: LegalPage.Entity,
  locale: string | null,
): string | null => (locale === null ? null : (page.translations[locale]?.['body'] ?? null))

/** Nouvelle langue par défaut (ADR 0014) : les traductions de `to` passent dans les champs. */
export const switchLegalPageLocale = (
  page: LegalPage.Editable,
  from: string,
  to: string,
): LegalPage.Editable => {
  const { texts, translations } = switchDefaultLocale(
    { title: page.title, body: page.body },
    page.translations,
    from,
    to,
  )
  return { ...page, ...texts, translations }
}
