import { z } from 'zod'

export const slideContract = z
  .object({
    id: z.int(),
    slug: z.string(),
    title: z.string(),
    text: z.string(),
    image: z.int(),
  })
  .meta({
    id: 'Slide',
    description: "Liste les diapositives dans l'ordre du carrousel, sans pagination.",
  })

export const legalSectionContract = z
  .object({
    title: z.string(),
    html: z.string(),
  })
  .meta({ id: 'LegalSection' })

export const legalPageContract = z
  .object({
    slug: z.string(),
    title: z.string(),
    introduction: z.string(),
    sections: z.array(legalSectionContract),
  })
  .meta({
    id: 'LegalPage',
    description:
      'Lit une page légale par son slug (mentions-legales, donnees-personnelles, accessibilite).',
  })
