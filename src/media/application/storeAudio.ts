import { audio, audioFileName, checkAudio, roundedDuration } from '#/media/domain/audioRules.ts'

import type { MediaDependencies } from './storeImage.ts'
import type { Media } from '#/media/domain/Media.ts'

/**
 * Contrôle un fichier audio envoyé et le stocke tel quel (ADR 0009) : 100 Mo au plus, format reconnu
 * à son contenu, durée lue dans ses en-têtes, empreinte sha256("audio\n" + contenu) tronquée.
 */
export const storeAudio = async (
  dependencies: MediaDependencies,
  content: Uint8Array,
): Promise<Media.Audio> => {
  const source = checkAudio(content.byteLength, dependencies.audioInspector.inspect(content))
  const stored = audio(
    dependencies.fingerprint('audio', content),
    source.format,
    roundedDuration(source.durationSeconds),
  )
  if (!(await dependencies.storage.has(audioFileName(stored)))) {
    await dependencies.storage.put(audioFileName(stored), content)
  }
  return stored
}
