import { z } from 'zod'

const DEFAULT_CORS_ALLOW_ORIGIN =
  '^http://localhost:(3000|3010|3100|3102|3110|3111|3112|3120|3121|3122|3130|3133|3150|3151|3170|3171|3200|3210|3220|3230|3250|3270|4321|5173|8095)$'

const configSchema = z.object({
  APP_ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1).default('mongodb://app:app@127.0.0.1:27017/?authSource=admin'),
  MONGODB_DB: z.string().min(1).default('app'),
  CORS_ALLOW_ORIGIN: z.string().min(1).default(DEFAULT_CORS_ALLOW_ORIGIN),
  GLITCHTIP_DSN: z
    .string()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  GLITCHTIP_ENVIRONMENT: z.string().optional(),
})

/** Sans GLITCHTIP_ENVIRONMENT, l'environnement remonté est celui de l'application (APP_ENV). */
const withDefaults = configSchema.transform((config) => ({
  ...config,
  GLITCHTIP_ENVIRONMENT:
    config.GLITCHTIP_ENVIRONMENT === undefined || config.GLITCHTIP_ENVIRONMENT === ''
      ? config.APP_ENV
      : config.GLITCHTIP_ENVIRONMENT,
}))

export type Config = z.infer<typeof withDefaults>

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => withDefaults.parse(env)
