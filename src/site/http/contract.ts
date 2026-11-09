import { z } from 'zod'

import { COLOR_SCHEMES } from '#/site/domain/SiteIdentity.ts'
import { imageViewContract } from '#/media/http/imageContract.ts'

const hex = () => z.string().regex(/^#[0-9a-f]{6}$/)

/** Les douze jetons de couleur de marque de boilerplates-ui pour un thème, sous leur nom sans le préfixe « color. ». */
export const themeTokensContract = z
  .object({
    primary: hex(),
    'primary-dark': hex(),
    'on-primary': hex(),
    'primary-surface-subtle': hex(),
    'primary-surface': hex(),
    'primary-surface-strong': hex(),
    secondary: hex(),
    'secondary-dark': hex(),
    'on-secondary': hex(),
    'secondary-surface-subtle': hex(),
    'secondary-surface': hex(),
    'secondary-surface-strong': hex(),
  })
  .meta({ id: 'ThemeTokens' })

export const siteThemeContract = z
  .object({
    // Pas de description sur ces deux propriétés : zod-openapi recopierait ThemeTokens au lieu de le référencer
    light: themeTokensContract,
    dark: themeTokensContract,
  })
  .meta({ id: 'SiteTheme' })

/** Favicons générés depuis l'icône du site (ADR 0011) : adresses absolues des PNG carrés. */
export const siteIconContract = z
  .object({
    png32: z.string().meta({ description: 'PNG de 32 px : <link rel="icon" sizes="32x32">.' }),
    png180: z.string().meta({ description: 'PNG de 180 px : <link rel="apple-touch-icon">.' }),
    png192: z.string().meta({ description: 'PNG de 192 px : icône du manifeste.' }),
    png512: z.string().meta({ description: 'PNG de 512 px : icône du manifeste.' }),
  })
  .meta({ id: 'SiteIcon' })

export const siteIdentityContract = z
  .object({
    name: z.string().meta({ description: 'Nom du site, 1 à 60 caractères.' }),
    tagline: z.string().meta({ description: 'Accroche, 0 à 160 caractères.' }),
    logo: z.union([imageViewContract, z.null()]).meta({
      description:
        'Logo, ratio du fichier gardé (largeurs 200 et 400), null sans logo : les fronts affichent alors le pictogramme et le nom.',
    }),
    shareImage: z.union([imageViewContract, z.null()]).meta({
      description:
        'Image de partage (og:image, twitter:image) par défaut, 1200 × 630, null sans image : les fronts gardent la leur.',
    }),
    icon: z.union([siteIconContract, z.null()]).meta({
      description:
        'Favicons en PNG (32, 180, 192 et 512 px), null sans icône : les fronts gardent leurs fichiers.',
    }),
    defaultColorScheme: z.enum(COLOR_SCHEMES),
    salesEnabled: z.boolean().meta({
      description:
        "Vente en ligne : false, les fronts n'affichent ni prix ni panier et chaque produit propose une demande de renseignement.",
    }),
    theme: z.union([siteThemeContract, z.null()]).meta({
      description:
        'Jetons de couleur de marque calculés, null sans couleurs saisies : le front garde alors ceux de boilerplates-ui.',
    }),
    locales: z.array(z.string()).meta({
      description:
        'Langues du site, codes BCP 47 courts, la langue par défaut en premier ; ["fr"] tant qu\'aucune autre n\'est activée.',
    }),
  })
  .meta({ id: 'SiteIdentity', description: "Lit l'identité du site." })
