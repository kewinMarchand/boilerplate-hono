import { z } from 'zod'

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
