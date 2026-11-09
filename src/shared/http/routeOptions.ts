import type { ContentLocaleResolver } from './contentLocale.ts'

export interface RouteOptions {
  /** X-Scenario actif (dev et test). */
  readonly scenarios: boolean
  /** Origine publique de l'API, préfixe des adresses des images (MEDIA_BASE_URL). */
  readonly mediaBaseUrl: string
  /** Langue du contenu demandée par la requête (ADR 0014). */
  readonly contentLocale: ContentLocaleResolver
}
