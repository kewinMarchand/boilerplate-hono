import { z } from 'zod'

import type { CollectionDefinition } from './mongo.ts'
import type { Collection } from 'mongodb'

const counterDocumentSchema = z.object({
  _id: z.string(),
  sequence: z.int().min(0),
})

export type CounterDocument = z.infer<typeof counterDocumentSchema>

/** Un compteur par collection à identifiants entiers, comme une séquence PostgreSQL. */
export const counterCollection: CollectionDefinition<typeof counterDocumentSchema> = {
  name: 'counters',
  schema: counterDocumentSchema,
  indexes: [],
}

/**
 * Identifiant suivant de la séquence `name`, jamais inférieur ou égal à `floor` : les fixtures
 * occupent déjà des identifiants que le compteur ne connaît pas.
 */
export const nextSequence = async (
  counters: Collection<CounterDocument>,
  name: string,
  floor = 0,
): Promise<number> => {
  await counters.updateOne({ _id: name }, { $max: { sequence: floor } }, { upsert: true })
  const counter = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { sequence: 1 } },
    { returnDocument: 'after' },
  )

  return counter?.sequence ?? floor + 1
}
