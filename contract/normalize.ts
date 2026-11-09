/** Clés de débogage de Symfony en environnement dev, absentes en production. */
const DEBUG_KEYS = new Set(['trace', 'class'])
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/

export interface NormalizeOptions {
  readonly origins: readonly string[]
  readonly volatileId: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Corps JSON comparable : clés triées, clés de débogage retirées, origine des URL masquée,
 * date de réception masquée, identifiant masqué quand il dépend de l'état de la base.
 */
export const normalizeJson = (value: unknown, options: NormalizeOptions, key = ''): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item, options))
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((name) => !DEBUG_KEYS.has(name))
        .sort()
        .map((name) => [name, normalizeJson(value[name], options, name)]),
    )
  }
  if (typeof value === 'string') {
    if (ISO_DATE_TIME.test(value)) {
      return '<date-heure>'
    }
    return options.origins.reduce((text, origin) => text.replaceAll(origin, '<origine>'), value)
  }
  if (key === 'id' && options.volatileId && typeof value === 'number') {
    return '<id>'
  }

  return value
}

/** Valeurs de Vary comparées. */
const CONTRACT_VARY = new Set(['accept-language'])

export const normalizeHeader = (name: string, value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  if (name === 'content-type') {
    return trimmed.toLowerCase().replace(/\s*;\s*/g, '; ')
  }
  if (name === 'location' || name === 'content-location') {
    return trimmed.replace(/\/\d+/, '/<id>')
  }
  if (name === 'vary') {
    // Seul Accept-Language est du contrat (ADR 0014) : les autres valeurs viennent des bundles de l'API Platform
    return trimmed
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter((token) => CONTRACT_VARY.has(token))
      .join(', ')
  }

  return trimmed
}

export const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    const value: unknown = JSON.parse(text)
    return { ok: true, value }
  } catch {
    return { ok: false }
  }
}
