import { describe, expect, it } from 'vitest'

import { MAX_AUDIO_BYTES } from '#/media/domain/audioRules.ts'
import { storeAudio } from '#/media/application/storeAudio.ts'

import { fakeMedia, photo } from './fakeMedia.ts'

/** Mêmes cas que StoreAudioTest de l'API Platform. */
describe('storeAudio', () => {
  it('stocke le fichier tel quel sous son empreinte, avec sa durée arrondie', async () => {
    const { media, files } = fakeMedia()
    const content = photo('audio/m4a 1559.6')

    const audio = await storeAudio(media, content)

    expect(audio.key).toMatch(/^[0-9a-f]{32}$/)
    expect([audio.format, audio.durationSeconds]).toEqual(['m4a', 1560])
    expect([...files.entries()]).toEqual([[`${audio.key}.m4a`, content]])
  })

  it('compte une seconde pour un fichier très court', async () => {
    expect((await storeAudio(fakeMedia().media, photo('audio/mp3 0.2'))).durationSeconds).toBe(1)
  })

  it('donne la même empreinte au même fichier : sha256("audio\\n" + contenu), tronquée', async () => {
    const { media } = fakeMedia()
    const content = photo('audio/mp3 3')

    expect((await storeAudio(media, content)).key).toBe(media.fingerprint('audio', content))
    expect((await storeAudio(media, content)).key).toBe((await storeAudio(media, content)).key)
  })

  it('refuse un fichier qui n’est pas de l’audio', async () => {
    await expect(storeAudio(fakeMedia().media, photo('son'))).rejects.toThrow(
      'Le fichier ne se lit pas comme un fichier audio MP3, M4A ou OGG.',
    )
  })

  it('refuse un fichier de plus de 100 Mo', async () => {
    const content = new Uint8Array(MAX_AUDIO_BYTES + 1)
    content.set(photo('audio/mp3 3'))

    await expect(storeAudio(fakeMedia().media, content)).rejects.toThrow(
      'Le fichier audio pèse plus de 100 Mo.',
    )
  })
})
