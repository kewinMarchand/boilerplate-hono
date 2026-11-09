/**
 * Textes d'un élément dans les langues autres que la langue par défaut (SPEC-COMMUNE, section 29,
 * ADR 0014) : `{ langue: { champ: valeur } }`. Les champs de l'élément portent la langue par défaut.
 * Un champ absent dans la langue demandée prend la valeur de la langue par défaut (repli champ par
 * champ). Les valeurs vides ne sont pas gardées : vide veut dire « non traduit ».
 */
export type Translations = Readonly<Record<string, Readonly<Record<string, string>>>>

/** Saisie de l'admin, par langue puis par champ ; une valeur vide ou absente veut dire « non traduit ». */
export type TranslationsInput = Readonly<
  Record<string, Readonly<Record<string, string | undefined>>>
>

/** Code BCP 47 court : la langue seule, sans région. */
export const LOCALE_PATTERN = /^[a-z]{2}$/

/** Valeur traduite d'un champ, ou celle de la langue par défaut. Locale null : la langue par défaut. */
export const translated = (
  translations: Translations,
  field: string,
  fallback: string,
  locale: string | null,
): string => (locale === null ? fallback : (translations[locale]?.[field] ?? fallback))

/** Blancs de début et de fin retirés, fins de ligne ramenées à LF, valeurs vides et langues vides écartées. */
export const keptTranslations = (input: TranslationsInput): Translations =>
  Object.fromEntries(
    Object.entries(input).flatMap(([locale, fields]) => {
      const kept = Object.entries(fields).flatMap(([field, value]) => {
        const text = (value ?? '').replaceAll('\r\n', '\n').trim()
        return text === '' ? [] : [[field, text] as const]
      })
      return kept.length === 0 ? [] : [[locale, Object.fromEntries(kept)] as const]
    }),
  )

/**
 * Rend la langue `to` langue par défaut : ses traductions passent dans les champs (champ par champ,
 * la valeur actuelle reste quand le champ n'est pas traduit), les valeurs actuelles deviennent la
 * traduction `from`. `texts` : champs traduisibles et leur valeur dans la langue par défaut.
 */
export const switchDefaultLocale = <TTexts extends Readonly<Record<string, string>>>(
  texts: TTexts,
  translations: Translations,
  from: string,
  to: string,
): { readonly texts: TTexts; readonly translations: Translations } => {
  if (from === to) {
    return { texts, translations }
  }
  const target = translations[to] ?? {}
  const { [to]: _, ...others } = translations
  const previous = Object.fromEntries(Object.entries(texts).filter(([, value]) => value !== ''))

  return {
    texts: { ...texts, ...pick(target, Object.keys(texts)) },
    translations: Object.keys(previous).length === 0 ? others : { ...others, [from]: previous },
  }
}

const pick = (values: Readonly<Record<string, string>>, keys: readonly string[]) =>
  Object.fromEntries(Object.entries(values).filter(([key]) => keys.includes(key)))

/**
 * Unicité d'un slug dans chaque langue. Dans une langue traduite, un élément a son slug traduit ou,
 * à défaut, celui de la langue par défaut : ce slug-là ne doit appartenir à aucun autre élément de
 * la langue. `translations` : la saisie, une entrée par langue de l'admin, même vide (comme
 * TranslatedSlugs de l'API Platform). `isTaken(slug, locale)` : un autre élément porte ce slug dans
 * la langue (null : la langue par défaut). Rend le premier slug déjà pris, null s'il n'y en a pas.
 */
export const takenSlug = async (
  slug: string,
  translations: TranslationsInput,
  isTaken: (slug: string, locale: string | null) => Promise<boolean>,
): Promise<string | null> => {
  const candidates: [string, string | null][] = [
    [slug, null],
    ...Object.entries(translations).map(([locale, fields]): [string, string] => {
      const translatedSlug = (fields['slug'] ?? '').trim()
      return [translatedSlug === '' ? slug : translatedSlug, locale]
    }),
  ]
  for (const [candidate, locale] of candidates) {
    if (await isTaken(candidate, locale)) {
      return candidate
    }
  }

  return null
}
