import { z } from 'zod'

import { alternatesContract } from '#/shared/http/alternateContract.ts'

import { audioViewContract, imageViewContract } from '#/media/http/imageContract.ts'

export const articleTermLinkContract = z
  .object({ slug: z.string(), name: z.string() })
  .meta({ id: 'ArticleTermLink' })

export const articleTermContract = z
  .object({
    slug: z.string().meta({
      description:
        'Slug, unique dans sa liste : valeur des filtres section et format de GET /api/articles.',
    }),
    name: z.string(),
  })
  .meta({
    id: 'ArticleTerm',
    description: "Liste les rubriques par position, y compris celles qu'aucun article ne porte.",
  })

export const articleContract = z
  .object({
    id: z.int(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string(),
    publishedAt: z.iso.date(),
    image: z.union([imageViewContract, z.null()]),
    section: z
      .union([articleTermLinkContract, z.null()])
      .meta({ description: "Rubrique de l'article, null s'il n'en a pas." }),
    format: z
      .union([articleTermLinkContract, z.null()])
      .meta({ description: "Format de l'article, null s'il n'en a pas." }),
    audio: z
      .union([audioViewContract, z.null()])
      .meta({ description: "Fichier audio de l'article, null s'il n'en a pas." }),
    speaker: z.string().meta({
      description:
        "Intervenant (« Présenté par … »), 80 caractères au plus ; chaîne vide s'il n'y en a pas.",
    }),
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
    metaTitle: z.string().meta({
      description:
        "Titre pour les moteurs de recherche, 60 caractères au plus ; chaîne vide si l'admin n'en a pas saisi.",
    }),
    metaDescription: z.string().meta({
      description:
        "Description pour les moteurs de recherche, 160 caractères au plus ; chaîne vide si l'admin n'en a pas saisi.",
    }),
    alternates: alternatesContract(
      "L'article dans chaque langue activée, langue demandée comprise, pour les hreflang et le sélecteur de langue ; tableau vide sur un site monolingue.",
    ),
  })
  .meta({ id: 'ArticleDetail', description: 'Lit un article par son slug.' })

/**
 * Filtres de la liste, publiés comme dans l'API Platform, sans validation : la lecture réelle suit
 * la sémantique PHP de la query string (une valeur en tableau est ignorée).
 */
export const articleQueryDocumentation = z.object({
  section: z.unknown().optional().meta({
    type: 'string',
    description: 'Slug de rubrique (GET /api/article-sections). Slug inconnu : liste vide.',
  }),
  format: z.unknown().optional().meta({
    type: 'string',
    description: 'Slug de format (GET /api/article-formats). Slug inconnu : liste vide.',
  }),
})
