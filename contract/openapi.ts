const COMPARED_SCHEMAS = [
  'Task',
  'Article',
  'ContactMessage',
  'Category',
  'ProductList',
  'ProductItem',
  'ProductFacets',
  'FacetValue',
  'CategoryFacetValue',
  'Slide',
  'LegalPage',
  'LegalSection',
  'ConstraintViolation',
  'Error',
]
const COMPARED_MEDIA_TYPES = ['application/json', 'application/problem+json']
const IGNORED_SCHEMA_KEYS = new Set(['description', 'externalDocs', 'deprecated'])

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const record = (value: unknown): JsonRecord => (isRecord(value) ? value : {})

const isNullSchema = (value: unknown): boolean => isRecord(value) && value['type'] === 'null'

/** Ramène les deux écritures de « nullable » (type tableau, anyOf avec null) à une seule. */
const normalizeSchema = (schema: unknown): unknown => {
  if (Array.isArray(schema)) {
    return schema.map(normalizeSchema)
  }
  if (!isRecord(schema)) {
    return schema
  }

  const anyOf: unknown = schema['anyOf']
  if (Array.isArray(anyOf) && anyOf.length === 2 && anyOf.some(isNullSchema)) {
    const inner: unknown = anyOf.find((item) => !isNullSchema(item))
    const merged = { ...record(inner), ...schema, anyOf: undefined }
    const innerType = record(inner)['type']
    return normalizeSchema({ ...merged, type: [innerType, 'null'] })
  }

  const result: JsonRecord = {}
  for (const key of Object.keys(schema).sort()) {
    const value = schema[key]
    if (value === undefined || IGNORED_SCHEMA_KEYS.has(key)) {
      continue
    }
    if (key === '$ref' && typeof value === 'string') {
      result[key] = value.split('/').at(-1)
    } else if (key === 'type' && Array.isArray(value)) {
      result[key] = value.map(String).sort()
    } else if (key === 'required' && Array.isArray(value)) {
      result[key] = value.map(String).sort()
    } else {
      result[key] = normalizeSchema(value)
    }
  }

  return result
}

const parameters = (operation: JsonRecord): unknown =>
  (Array.isArray(operation['parameters']) ? operation['parameters'] : [])
    .map(record)
    .map((parameter) => ({
      name: parameter['name'],
      in: parameter['in'],
      required: parameter['required'] ?? false,
      schema: normalizeSchema(parameter['schema']),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))

const content = (value: unknown): unknown =>
  Object.fromEntries(
    Object.entries(record(record(value)['content']))
      .filter(([mediaType]) => COMPARED_MEDIA_TYPES.includes(mediaType))
      .map(([mediaType, media]) => [mediaType, normalizeSchema(record(media)['schema'])]),
  )

const operationShape = (operation: JsonRecord, ignoredStatuses: readonly string[]): unknown => ({
  operationId: operation['operationId'],
  tags: operation['tags'],
  parameters: parameters(operation),
  requestBodyRequired: record(operation['requestBody'])['required'] ?? null,
  responses: Object.fromEntries(
    Object.entries(record(operation['responses']))
      .filter(([status]) => !ignoredStatuses.includes(status))
      .map(([status, response]) => [status, content(response)]),
  ),
})

/** Forme comparable d'un document OpenAPI : chemins, opérations, schémas utiles aux fronts. */
export const openApiShape = (
  document: unknown,
  ignoredResponses: Readonly<Record<string, readonly string[]>> = {},
): Record<string, unknown> => {
  const root = record(document)
  const shape: Record<string, unknown> = {}

  for (const [path, item] of Object.entries(record(root['paths']))) {
    for (const [method, operation] of Object.entries(record(item))) {
      if (isRecord(operation)) {
        const key = `${method.toUpperCase()} ${path}`
        shape[key] = operationShape(operation, ignoredResponses[key] ?? [])
      }
    }
  }
  const schemas = record(record(root['components'])['schemas'])
  for (const name of COMPARED_SCHEMAS) {
    shape[`schéma ${name}`] = normalizeSchema(schemas[name]) ?? null
  }

  return shape
}
