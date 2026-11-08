import { z } from 'zod'

const DEFAULT_CORS_ALLOW_ORIGIN =
  '^http://localhost:(3000|3010|3100|3102|3110|3111|3112|3120|3121|3122|3130|3133|3150|3151|3170|3171|3200|3210|3220|3230|3250|3270|4321|5173|8095)$'

/** Secret de développement et de test : refusé en production (ADMIN_SESSION_SECRET obligatoire). */
const DEV_SESSION_SECRET = 'secret-de-developpement-a-ne-pas-utiliser-en-production'

const configSchema = z.object({
  APP_ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1).default('mongodb://app:app@127.0.0.1:27017/?authSource=admin'),
  MONGODB_DB: z.string().min(1).default('app'),
  CORS_ALLOW_ORIGIN: z.string().min(1).default(DEFAULT_CORS_ALLOW_ORIGIN),
  /** Origine publique de l'API, vue par le navigateur : préfixe des adresses des images (ADR 0002). */
  MEDIA_BASE_URL: z.url().default('http://localhost:8091'),
  /** Dossier des variantes des images envoyées par l'admin, servi sous /media/. */
  MEDIA_DIR: z.string().min(1).default('var/media'),
  /** Serveur SMTP des mails du contact (SPEC-COMMUNE, section 27) : Mailpit en développement. */
  MAILER_DSN: z.url({ protocol: /^smtps?$/ }).default('smtp://mailpit:1025'),
  /** Expéditeur des mails du contact ; la réponse va au visiteur (Reply-To). */
  MAILER_FROM: z.email().default('site@example.com'),
  GLITCHTIP_DSN: z
    .string()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  GLITCHTIP_ENVIRONMENT: z.string().optional(),
  /** Clé HMAC des sessions de l'admin, 32 caractères au moins. */
  ADMIN_SESSION_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(32).default(DEV_SESSION_SECRET),
  ),
})

/** Sans GLITCHTIP_ENVIRONMENT, l'environnement remonté est celui de l'application (APP_ENV). */
const withDefaults = configSchema
  .refine(
    (config) => config.APP_ENV !== 'prod' || config.ADMIN_SESSION_SECRET !== DEV_SESSION_SECRET,
    {
      message: 'ADMIN_SESSION_SECRET est obligatoire en production.',
      path: ['ADMIN_SESSION_SECRET'],
    },
  )
  .transform((config) => ({
    ...config,
    GLITCHTIP_ENVIRONMENT:
      config.GLITCHTIP_ENVIRONMENT === undefined || config.GLITCHTIP_ENVIRONMENT === ''
        ? config.APP_ENV
        : config.GLITCHTIP_ENVIRONMENT,
  }))

export type Config = z.infer<typeof withDefaults>

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => withDefaults.parse(env)
