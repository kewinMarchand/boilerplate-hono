import { MediaRuleViolation } from './imageRules.ts'

import type { Media } from './Media.ts'

/** Règles des fichiers audio des articles, mêmes valeurs et mêmes messages que l'API Platform (ADR 0009). */
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024
export const AUDIO_FORMATS = ['mp3', 'm4a', 'ogg'] as const satisfies readonly Media.AudioFormat[]

const KEY_PATTERN = /^[0-9a-f]{32}$/

/** Nom du fichier stocké : l'empreinte et l'extension du format. */
export const audioFileName = ({ key, format }: Media.Audio): string => `${key}.${format}`

export const audio = (
  key: string,
  format: Media.AudioFormat,
  durationSeconds: number,
): Media.Audio => {
  if (!KEY_PATTERN.test(key)) {
    throw new MediaRuleViolation(`Empreinte de fichier audio invalide : « ${key} ».`)
  }
  if (durationSeconds < 0) {
    throw new MediaRuleViolation("La durée d'un fichier audio ne peut pas être négative.")
  }
  return { key, format, durationSeconds }
}

/** Contrôle d'un fichier envoyé, une fois lu par l'inspecteur ; rend ce qu'il en a lu. */
export const checkAudio = (size: number, source: Media.SourceAudio | null): Media.SourceAudio => {
  if (size > MAX_AUDIO_BYTES) {
    throw new MediaRuleViolation('Le fichier audio pèse plus de 100 Mo.')
  }
  if (source === null) {
    throw new MediaRuleViolation('Le fichier ne se lit pas comme un fichier audio MP3, M4A ou OGG.')
  }
  return source
}

/** Durée enregistrée : arrondie, 1 seconde au moins. */
export const roundedDuration = (seconds: number): number => Math.max(1, Math.round(seconds))
