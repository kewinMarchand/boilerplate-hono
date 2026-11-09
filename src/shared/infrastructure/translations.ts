import { z } from 'zod'

import type { Document } from 'mongodb'

/**
 * Traductions d'un document (ADR 0014) : `{ langue: { champ: valeur } }`, valeurs non vides. Un
 * sous-document par document traduisible, à côté des champs de la langue par défaut.
 */
export const translationsSchema = () =>
  z.record(z.string().regex(/^[a-z]{2}$/), z.record(z.string(), z.string().min(1)))

/**
 * Filtre sur le slug effectif dans une langue : le slug traduit, ou celui de la langue par défaut
 * quand il n'est pas traduit (une traduction vide n'est jamais gardée). `locale` vient des langues
 * activées, codes de deux lettres : sûr dans un chemin de champ. Null ou absent : la langue par défaut.
 */
export const slugFilter = (slug: string, locale: string | null | undefined): Document => {
  if (locale === null || locale === undefined) {
    return { slug }
  }
  const translatedSlug = `translations.${locale}.slug`
  return { $or: [{ [translatedSlug]: slug }, { slug, [translatedSlug]: { $exists: false } }] }
}
