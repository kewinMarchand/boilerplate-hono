import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { headerAudioInspector } from '#/media/infrastructure/headerAudioInspector.ts'

/**
 * Fichiers de tests/fixtures/audio, ceux de l'API Platform, générés par ffmpeg (bip de 440 Hz) ;
 * durées attendues : celles que lit ffprobe. Mêmes cas que HeaderAudioInspectorTest.
 */
const read = (path: string) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))

describe('lecture des en-têtes audio', () => {
  it.each([
    ['beep-3s-cbr.mp3', 'mp3', 3.03],
    ['beep-3s-vbr-id3.mp3', 'mp3', 3.03],
    ['beep-3s.ogg', 'ogg', 3],
    ['beep-3s.opus', 'ogg', 3],
    ['beep-3s.m4a', 'm4a', 3],
    ['beep-3s-faststart.m4a', 'm4a', 3],
  ])('lit le format et la durée de %s', (file, format, duration) => {
    const source = headerAudioInspector.inspect(read(`../fixtures/audio/${file}`))

    expect(source?.format).toBe(format)
    expect(Math.abs((source?.durationSeconds ?? 0) - duration)).toBeLessThan(0.01)
  })

  it('lit le fichier de démonstration des fixtures (4,05 s)', () => {
    const source = headerAudioInspector.inspect(read('../../fixtures/audio/article-demo.mp3'))

    expect(Math.abs((source?.durationSeconds ?? 0) - 4.05)).toBeLessThan(0.01)
  })

  it.each([
    '../fixtures/audio/video-1s.mp4',
    '../../fixtures/images/blog-1.webp',
    '../../package.json',
  ])('refuse un fichier qui n’est pas un fichier audio accepté (%s)', (path) => {
    expect(headerAudioInspector.inspect(read(path))).toBeNull()
  })

  it('refuse un contenu vide', () => {
    expect(headerAudioInspector.inspect(new Uint8Array())).toBeNull()
  })
})
