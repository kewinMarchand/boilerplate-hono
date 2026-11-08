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

export const siteIdentityContract = z
  .object({
    name: z.string().meta({ description: 'Nom du site, 1 à 60 caractères.' }),
    tagline: z.string().meta({ description: 'Accroche, 0 à 160 caractères.' }),
    logo: z.union([imageViewContract, z.null()]).meta({
      description:
        'Logo, ratio du fichier gardé (largeurs 200 et 400), null sans logo : les fronts affichent alors le pictogramme et le nom.',
    }),
    defaultColorScheme: z.enum(COLOR_SCHEMES),
    theme: z.union([siteThemeContract, z.null()]).meta({
      description:
        'Jetons de couleur de marque calculés, null sans couleurs saisies : le front garde alors ceux de boilerplates-ui.',
    }),
  })
  .meta({ id: 'SiteIdentity', description: "Lit l'identité du site." })
