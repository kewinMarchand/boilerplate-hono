import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { fingerprint, sharpImageEncoder } from '#/media/infrastructure/sharpImageEncoder.ts'

const WITNESS = 'TEMOIN-GPS-48.8566N'

/** JPEG avec des métadonnées EXIF : orientation, et une description qui sert de témoin. */
const jpegWithExif = async (width: number, height: number, orientation = 1) =>
  new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: '#c81e1e' } })
      .jpeg()
      .withExif({ IFD0: { ImageDescription: WITNESS } })
      .withMetadata({ orientation })
      .toBuffer(),
  )

describe('encodeur sharp (réel)', () => {
  it('lit le type et les dimensions, orientation EXIF appliquée', async () => {
    const source = await sharpImageEncoder.inspect(await jpegWithExif(1600, 900, 6))

    expect(source).toEqual({ mimeType: 'image/jpeg', width: 900, height: 1600 })
  })

  it('refuse ce qui ne se lit pas comme une image', async () => {
    expect(await sharpImageEncoder.inspect(new TextEncoder().encode('%PDF-1.7'))).toBeNull()
  })

  it('recadre, redimensionne et retire toutes les métadonnées', async () => {
    const key = 'f'.repeat(32)
    const variants = await sharpImageEncoder.variants(
      await jpegWithExif(1600, 900, 6),
      key,
      'product',
    )

    expect([...variants.keys()]).toEqual([
      `${key}-400.avif`,
      `${key}-400.webp`,
      `${key}-640.avif`,
      `${key}-640.webp`,
      `${key}-800.avif`,
      `${key}-800.webp`,
    ])
    for (const [name, content] of variants) {
      const metadata = await sharp(content).metadata()
      const width = Number(/-(\d+)\./.exec(name)?.[1])
      expect([metadata.width, metadata.height], name).toEqual([width, width])
      expect(metadata.format, name).toBe(name.endsWith('.avif') ? 'heif' : 'webp')
      expect(metadata.exif, name).toBeUndefined()
      expect(Buffer.from(content).includes(WITNESS), name).toBe(false)
    }
  })

  it('recadre une image d’article au format 16:9', async () => {
    const key = 'e'.repeat(32)
    const variants = await sharpImageEncoder.variants(
      await jpegWithExif(2000, 2000),
      key,
      'article',
    )
    const largest = variants.get(`${key}-960.webp`)

    expect(largest).toBeDefined()
    const metadata = await sharp(largest).metadata()
    expect([metadata.width, metadata.height]).toEqual([960, 540])
  })

  it('calcule la même empreinte que l’API Platform : sha256(usage + "\\n" + contenu), tronquée', () => {
    expect(fingerprint('article', new TextEncoder().encode('abc'))).toBe(
      'a1d5534dfd7f3e0043c943fa13e72e29',
    )
  })
})
