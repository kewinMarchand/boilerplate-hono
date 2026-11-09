import { z } from 'zod'

/** Version d'un élément dans une langue (ADR 0014), pour les hreflang et le sélecteur de langue des fronts. */
export const alternateContract = z
  .object({
    locale: z.string().meta({ description: 'Code de langue BCP 47 court (fr, en).' }),
    slug: z.string().meta({
      description:
        "Slug de l'élément dans cette langue : le sien, ou celui de la langue par défaut s'il n'est pas traduit.",
    }),
  })
  .meta({ id: 'Alternate' })

/** `alternates` d'une ressource détaillée, avec sa description. */
export const alternatesContract = (description: string) =>
  z.array(alternateContract).meta({ description })
