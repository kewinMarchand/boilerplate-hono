import { z } from 'zod'

import { META_PAGES } from '#/content/domain/PageMeta.ts'

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

export const pageMetaContract = z
  .object({
    page: z.enum(META_PAGES.map(([page]) => page)),
    title: z.string().meta({
      description:
        'Titre pour les moteurs de recherche, 60 caractères au plus ; chaîne vide si non saisi.',
    }),
    description: z.string().meta({
      description:
        'Description pour les moteurs de recherche, 160 caractères au plus ; chaîne vide si non saisie.',
    }),
  })
  .meta({
    id: 'PageMeta',
    description:
      "Liste les pages fixes, toutes les clés, chaînes vides quand rien n'est saisi : le front garde alors ses valeurs.",
  })
