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
