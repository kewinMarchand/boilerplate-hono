import type { Media } from '#/media/domain/Media.ts'

/**
 * Lit le format et la durée d'un fichier audio dans ses en-têtes, en TypeScript seul (ADR 0009),
 * sans décoder le son, comme HeaderAudioInspector de l'API Platform :
 * - MP3 : tag ID3v2 sauté, deux en-têtes de trame consécutifs exigés, nombre de trames de l'en-tête
 *   Xing, Info ou VBRI, sinon débit constant appliqué à la taille des données ;
 * - OGG (Vorbis ou Opus) : position de la dernière page divisée par la fréquence de l'en-tête
 *   d'identification ;
 * - M4A : boîte mvhd (durée et échelle de temps), au moins une piste son et aucune piste vidéo.
 */
const MP3_BITRATES: Record<'mpeg1' | 'mpeg2', readonly number[]> = {
  mpeg1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  mpeg2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
/** Par version MPEG (3 : MPEG 1, 2 : MPEG 2, 0 : MPEG 2.5). */
const MP3_SAMPLE_RATES: Readonly<Record<number, readonly number[]>> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
}
const MP3_SCAN_BYTES = 65536
const OGG_TAIL_BYTES = 131072
const OPUS_SAMPLE_RATE = 48000
const MP4_MAX_MOOV_BYTES = 16 * 1024 * 1024

interface Mp3Frame {
  readonly version: number
  readonly mono: boolean
  readonly bitrate: number
  readonly sampleRate: number
  readonly samples: number
  readonly length: number
}

const text = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length))

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

/** Entier non signé gros-boutiste de 32 bits ; 0 si les octets manquent. */
const uint32 = (bytes: Uint8Array, offset: number): number =>
  offset + 4 <= bytes.length ? view(bytes).getUint32(offset) : 0

/** Entier non signé gros-boutiste de 64 bits ; 0 si les octets manquent. */
const uint64 = (bytes: Uint8Array, offset: number): number =>
  offset + 8 <= bytes.length ? Number(view(bytes).getBigUint64(offset)) : 0

/** Dernière position de `pattern` qui commence avant `before`, -1 sinon. */
const lastIndexOf = (bytes: Uint8Array, pattern: string, before: number): number => {
  for (let index = Math.min(before - 1, bytes.length - pattern.length); index >= 0; index--) {
    if (text(bytes, index, pattern.length) === pattern) {
      return index
    }
  }
  return -1
}

/** En-tête de trame MPEG Layer III, ou null s'il n'en est pas un. */
const mp3Frame = (bytes: Uint8Array, offset: number): Mp3Frame | null => {
  if (offset + 4 > bytes.length || bytes[offset] !== 0xff) {
    return null
  }
  const b1 = bytes[offset + 1] ?? 0
  const b2 = bytes[offset + 2] ?? 0
  const b3 = bytes[offset + 3] ?? 0
  const version = (b1 >> 3) & 0x03
  const layer = (b1 >> 1) & 0x03
  const bitrateIndex = b2 >> 4
  const sampleRateIndex = (b2 >> 2) & 0x03
  if (
    (b1 & 0xe0) !== 0xe0 ||
    version === 1 ||
    layer !== 1 ||
    bitrateIndex === 0 ||
    bitrateIndex === 15 ||
    sampleRateIndex === 3
  ) {
    return null
  }
  const mpeg1 = version === 3
  const bitrate = MP3_BITRATES[mpeg1 ? 'mpeg1' : 'mpeg2'][bitrateIndex] ?? 0
  const sampleRate = MP3_SAMPLE_RATES[version]?.[sampleRateIndex] ?? 0
  if (bitrate === 0 || sampleRate === 0) {
    return null
  }

  return {
    version,
    mono: b3 >> 6 === 3,
    bitrate,
    sampleRate,
    samples: mpeg1 ? 1152 : 576,
    length: Math.floor(((mpeg1 ? 144 : 72) * bitrate * 1000) / sampleRate) + ((b2 >> 1) & 0x01),
  }
}

/** Nombre de trames de l'en-tête Xing ou Info (après les informations annexes) ou VBRI (32 octets après l'en-tête). */
const mp3FrameCount = (start: Uint8Array, frame: Mp3Frame): number | null => {
  const sideInfo = frame.version === 3 ? (frame.mono ? 17 : 32) : frame.mono ? 9 : 17
  const xing = 4 + sideInfo
  if (xing + 12 <= start.length && ['Xing', 'Info'].includes(text(start, xing, 4))) {
    const frames = uint32(start, xing + 8)
    if ((uint32(start, xing + 4) & 0x01) === 1 && frames > 0) {
      return frames
    }
  }
  if (36 + 18 <= start.length && text(start, 36, 4) === 'VBRI') {
    const frames = uint32(start, 36 + 14)
    if (frames > 0) {
      return frames
    }
  }
  return null
}

const hasId3v1 = (content: Uint8Array): boolean =>
  content.length >= 128 && text(content, content.length - 128, 3) === 'TAG'

const mp3 = (content: Uint8Array): Media.SourceAudio | null => {
  let offset = 0
  if (content.length >= 10 && text(content, 0, 3) === 'ID3') {
    const [, , , , , flags = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0] = content
    const tagSize = ((s1 & 0x7f) << 21) | ((s2 & 0x7f) << 14) | ((s3 & 0x7f) << 7) | (s4 & 0x7f)
    offset = 10 + tagSize + (flags & 0x10 ? 10 : 0)
  }
  const buffer = content.subarray(offset, offset + MP3_SCAN_BYTES)

  for (let index = 0; index <= buffer.length - 4; index++) {
    if (buffer[index] !== 0xff || ((buffer[index + 1] ?? 0) & 0xe0) !== 0xe0) {
      continue
    }
    const frame = mp3Frame(buffer, index)
    if (frame === null) {
      continue
    }
    const next = index + frame.length
    if (next + 4 > buffer.length || mp3Frame(buffer, next) === null) {
      continue
    }

    const frames = mp3FrameCount(buffer.subarray(index, index + 64), frame)
    if (frames !== null) {
      return { format: 'mp3', durationSeconds: (frames * frame.samples) / frame.sampleRate }
    }
    const audioBytes = content.length - offset - index - (hasId3v1(content) ? 128 : 0)
    return { format: 'mp3', durationSeconds: (audioBytes * 8) / (frame.bitrate * 1000) }
  }

  return null
}

const ogg = (content: Uint8Array): Media.SourceAudio | null => {
  const page = content.subarray(0, 512)
  if (page.length < 28) {
    return null
  }
  const packet = page.subarray(27 + (page[26] ?? 0), 27 + (page[26] ?? 0) + 32)
  let sampleRate: number
  let preSkip: number
  if (text(packet, 0, 7) === '\x01vorbis') {
    sampleRate = packet.length >= 16 ? view(packet).getUint32(12, true) : 0
    preSkip = 0
  } else if (text(packet, 0, 8) === 'OpusHead') {
    sampleRate = OPUS_SAMPLE_RATE
    preSkip = packet.length >= 12 ? view(packet).getUint16(10, true) : 0
  } else {
    return null
  }
  if (sampleRate < 1) {
    return null
  }

  const tail = content.subarray(Math.max(0, content.length - OGG_TAIL_BYTES))
  for (
    let position = lastIndexOf(tail, 'OggS', tail.length);
    position !== -1;
    position = position > 0 ? lastIndexOf(tail, 'OggS', position) : -1
  ) {
    const granule =
      position + 14 <= tail.length ? Number(view(tail).getBigInt64(position + 6, true)) : 0
    // -1 : page sans fin de paquet, la position se lit sur une page précédente
    if (granule > 0) {
      return { format: 'ogg', durationSeconds: Math.max(0, granule - preSkip) / sampleRate }
    }
  }

  return null
}

/** Taille d'une boîte et de son en-tête : 1 annonce une taille sur 64 bits, 0 une boîte qui va jusqu'à la fin. */
const boxSize = (header: Uint8Array, remaining: number): readonly [number, number] => {
  if (header.length < 8) {
    return [0, 8]
  }
  const size = uint32(header, 0)
  if (size === 1 && header.length >= 16) {
    return [uint64(header, 8), 16]
  }
  return [size === 0 ? remaining : size, 8]
}

/** Boîtes filles d'un contenu : type et contenu. */
const boxes = (data: Uint8Array): (readonly [string, Uint8Array])[] => {
  const found: (readonly [string, Uint8Array])[] = []
  let position = 0
  while (position + 8 <= data.length) {
    const [size, headerSize] = boxSize(
      data.subarray(position, position + 16),
      data.length - position,
    )
    if (size < headerSize || position + size > data.length) {
      break
    }
    found.push([text(data, position + 4, 4), data.subarray(position + headerSize, position + size)])
    position += size
  }
  return found
}

const mvhdDuration = (mvhd: Uint8Array): number | null => {
  if (mvhd.length < 32) {
    return null
  }
  const [timescale, duration] =
    mvhd[0] === 1 ? [uint32(mvhd, 20), uint64(mvhd, 24)] : [uint32(mvhd, 12), uint32(mvhd, 16)]
  return timescale < 1 ? null : duration / timescale
}

const handlerType = (trak: Uint8Array): string | null => {
  for (const [type, mdia] of boxes(trak)) {
    if (type !== 'mdia') {
      continue
    }
    for (const [childType, hdlr] of boxes(mdia)) {
      if (childType === 'hdlr') {
        return text(hdlr, 8, 4)
      }
    }
  }
  return null
}

const moov = (data: Uint8Array): Media.SourceAudio | null => {
  let duration: number | null = null
  const handlers: (string | null)[] = []
  for (const [type, payload] of boxes(data)) {
    if (type === 'mvhd') {
      duration = mvhdDuration(payload)
    }
    if (type === 'trak') {
      handlers.push(handlerType(payload))
    }
  }
  if (duration === null || !handlers.includes('soun') || handlers.includes('vide')) {
    return null
  }
  return { format: 'm4a', durationSeconds: duration }
}

const mp4 = (content: Uint8Array): Media.SourceAudio | null => {
  let position = 0
  while (position + 8 <= content.length) {
    const [size, headerSize] = boxSize(
      content.subarray(position, position + 16),
      content.length - position,
    )
    if (size < headerSize) {
      return null
    }
    if (text(content, position + 4, 4) === 'moov') {
      if (size > MP4_MAX_MOOV_BYTES) {
        return null
      }
      const payload = content.subarray(position + headerSize, position + size)
      return payload.length > 0 ? moov(payload) : null
    }
    position += size
  }
  return null
}

export const headerAudioInspector: Media.AudioInspector = {
  inspect(content) {
    if (text(content, 0, 4) === 'OggS') {
      return ogg(content)
    }
    if (text(content, 4, 4) === 'ftyp') {
      return mp4(content)
    }
    return mp3(content)
  },
}
