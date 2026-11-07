import { z } from 'zod'

import { imageViewContract } from '#/media/http/imageContract.ts'

export const articleContract = z
  .object({
    id: z.int(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string(),
    publishedAt: z.iso.date(),
    image: z.union([imageViewContract, z.null()]),
  })
  .meta({
    id: 'Article',
    description: 'Liste les articles, du plus récent au plus ancien, sans pagination.',
  })

export const articleDetailContract = articleContract
  .extend({
    html: z.string().meta({
      description:
        "Texte de l'article en HTML, converti du Markdown saisi (HTML saisi échappé, liens dangereux retirés). Vide s'il n'y en a pas.",
    }),
  })
  .meta({ id: 'ArticleDetail', description: 'Lit un article par son slug.' })
