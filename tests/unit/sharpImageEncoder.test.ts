import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { widthsOf } from '#/media/domain/imageRules.ts'
import { storeImage } from '#/media/application/storeImage.ts'
import { fingerprint, sharpImageEncoder } from '#/media/infrastructure/sharpImageEncoder.ts'

import { fakeMedia } from './fakeMedia.ts'

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
      widthsOf('product'),
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
      widthsOf('article'),
    )
    const largest = variants.get(`${key}-960.webp`)

    expect(largest).toBeDefined()
    const metadata = await sharp(largest).metadata()
    expect([metadata.width, metadata.height]).toEqual([960, 540])
  })

  it('garde le ratio et la transparence d’un logo', async () => {
    const logo = await sharp({
      create: { width: 1000, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: {
            create: { width: 200, height: 100, channels: 4, background: '#c2410c' },
          },
          left: 400,
          top: 100,
        },
      ])
      .png()
      .toBuffer()
    const key = 'd'.repeat(32)

    const variants = await sharpImageEncoder.variants(
      new Uint8Array(logo),
      key,
      'logo',
      widthsOf('logo'),
    )

    expect([...variants.keys()]).toEqual([
      `${key}-200.avif`,
      `${key}-200.webp`,
      `${key}-400.avif`,
      `${key}-400.webp`,
    ])
    for (const [suffix, dimensions] of [
      ['200.webp', [200, 60]],
      ['400.webp', [400, 120]],
      ['400.avif', [400, 120]],
    ] as const) {
      const metadata = await sharp(variants.get(`${key}-${suffix}`)).metadata()
      expect([metadata.width, metadata.height], suffix).toEqual(dimensions)
      expect(metadata.hasAlpha, suffix).toBe(true)
    }
    const { data, info } = await sharp(variants.get(`${key}-400.webp`))
      .raw()
      .toBuffer({ resolveWithObject: true })
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3]
    expect(alphaAt(0, 0), 'coin transparent').toBe(0)
    expect(alphaAt(200, 60), 'centre opaque').toBe(255)
  })

  it('arrête une source étroite à sa largeur, sans l’agrandir', async () => {
    const key = 'c'.repeat(32)
    const variants = await sharpImageEncoder.variants(
      await jpegWithExif(600, 900),
      key,
      'product',
      [400, 600],
    )

    expect([...variants.keys()]).toEqual([
      `${key}-400.avif`,
      `${key}-400.webp`,
      `${key}-600.avif`,
      `${key}-600.webp`,
    ])
    const metadata = await sharp(variants.get(`${key}-600.webp`)).metadata()
    expect([metadata.width, metadata.height]).toEqual([600, 600])
  })

  it('écrit une icône en PNG carrés, transparence gardée', async () => {
    const icon = await sharp({
      create: { width: 600, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer()
    const key = 'b'.repeat(32)

    const variants = await sharpImageEncoder.variants(
      new Uint8Array(icon),
      key,
      'icon',
      widthsOf('icon'),
    )

    expect([...variants.keys()]).toEqual([
      `${key}-32.png`,
      `${key}-180.png`,
      `${key}-192.png`,
      `${key}-512.png`,
    ])
    const metadata = await sharp(variants.get(`${key}-180.png`)).metadata()
    expect([metadata.width, metadata.height, metadata.format]).toEqual([180, 180, 'png'])
    const { data } = await sharp(variants.get(`${key}-32.png`))
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(data[3], 'coin transparent').toBe(0)
  })

  it('refuse un logo SVG (contenu actif)', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><rect width="400" height="120"/></svg>',
    )
    const media = { ...fakeMedia().media, encoder: sharpImageEncoder }

    await expect(
      storeImage(media, { content: svg, alt: 'Oraki', decorative: false }, 'logo'),
    ).rejects.toThrow('Formats acceptés : JPEG, PNG, WebP ou AVIF.')
  })

  it('calcule la même empreinte que l’API Platform : sha256(usage + "\\n" + contenu), tronquée', () => {
    expect(fingerprint('article', new TextEncoder().encode('abc'))).toBe(
      'a1d5534dfd7f3e0043c943fa13e72e29',
    )
  })
})
