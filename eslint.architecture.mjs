/**
 * Règles de dépendance entre modules et couches (R13 de ARCHITECTURE-DDD.md), par
 * `no-restricted-imports` : tout import interne passe par l'alias `#/`, ce qui rend les motifs
 * fiables, et un import relatif qui remonte d'un dossier (`../`) est interdit partout.
 * `make arch-selftest` vérifie qu'une violation volontaire de chaque règle fait échouer le lint.
 */
const MODULES = ['task', 'blog', 'contact', 'catalog', 'content', 'admin', 'media']

const NO_PARENT_RELATIVE = {
  regex: '^\\.\\./',
  message: "Import interne par l'alias #/ : un chemin relatif contournerait les règles de couches.",
}

const NO_WEB_FRAMEWORK = {
  regex: '^(hono|@hono/.+)(/.*)?$',
  message: 'Hono est réservé à la couche http et à la composition (app.ts).',
}

const NO_DATABASE = {
  regex: '^mongodb(/.*)?$',
  message: 'MongoDB est réservé à la couche infrastructure et à la composition.',
}

const NO_ZOD = {
  regex: '^zod(/.*)?$',
  message: 'Le domaine et les cas d’utilisation ne dépendent d’aucune bibliothèque.',
}

/** Interdit tout import interne `#/…` hors des dossiers listés. */
const onlyInternal = (allowed, message) => ({
  regex: `^#/(?!(${allowed.join('|')})/)`,
  message,
})

/**
 * Couches de `media` (images envoyées par l'admin, ADR 0002 de l'API Platform) qu'une couche de
 * module peut importer : le module des images sert les contenus, le catalogue et le blog.
 */
const MEDIA = {
  domain: ['media/domain'],
  application: ['media/domain', 'media/application'],
  http: ['media/domain', 'media/http'],
  infrastructure: ['media/domain', 'media/infrastructure'],
}

const layer = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [NO_PARENT_RELATIVE, ...patterns] }] },
})

const moduleLayers = (module) => [
  layer(
    [`src/${module}/domain/**/*.ts`],
    [
      NO_WEB_FRAMEWORK,
      NO_DATABASE,
      NO_ZOD,
      onlyInternal(
        [`${module}/domain`, ...MEDIA.domain],
        `Couche domaine de ${module} : n'importe que le domaine de son module.`,
      ),
    ],
  ),
  layer(
    [`src/${module}/application/**/*.ts`],
    [
      NO_WEB_FRAMEWORK,
      NO_DATABASE,
      NO_ZOD,
      onlyInternal(
        [`${module}/domain`, `${module}/application`, ...MEDIA.application],
        `Couche application de ${module} : n'importe que le domaine et l'application de son module.`,
      ),
    ],
  ),
  layer(
    [`src/${module}/http/**/*.ts`],
    [
      NO_DATABASE,
      onlyInternal(
        [
          `${module}/domain`,
          `${module}/application`,
          `${module}/http`,
          'shared/http',
          ...MEDIA.http,
        ],
        `Couche http de ${module} : ni infrastructure, ni autre module.`,
      ),
    ],
  ),
  layer(
    [`src/${module}/infrastructure/**/*.ts`],
    [
      NO_WEB_FRAMEWORK,
      onlyInternal(
        [
          `${module}/domain`,
          `${module}/infrastructure`,
          'shared/infrastructure',
          ...MEDIA.infrastructure,
        ],
        `Couche infrastructure de ${module} : ni http, ni application, ni autre module.`,
      ),
    ],
  ),
]

export const architecture = [
  layer(['src/**/*.ts', 'tests/**/*.ts', 'contract/**/*.ts', 'tools/**/*.ts'], []),
  ...MODULES.flatMap(moduleLayers),
  layer(
    ['src/shared/http/**/*.ts'],
    [
      NO_DATABASE,
      onlyInternal(['shared/http'], 'shared/http ne dépend d’aucun module ni de l’infrastructure.'),
    ],
  ),
  layer(
    ['src/shared/infrastructure/**/*.ts'],
    [
      NO_WEB_FRAMEWORK,
      onlyInternal(
        ['shared/infrastructure'],
        'shared/infrastructure ne dépend d’aucun module ni de la couche http.',
      ),
    ],
  ),
]
