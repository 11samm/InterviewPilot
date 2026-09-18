/**
 * PCM helpers for Gemini Live API: mic capture is 16-bit PCM @ 16kHz (input);
 * model audio output is typically 24kHz little-endian PCM (see Live API docs).
 */

export function float32ToPcm16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i] ?? 0))
    out[i] =
      s < 0
        ? Math.round(s * 0x8000)
        : Math.round(s * 0x7fff)
  }
  return out
}

/** Downsample / resample linearly toward 16kHz (simple decimation). */
export function resampleFloat32To16k(
  input: Float32Array,
  inputSampleRate: number,
): Float32Array {
  if (inputSampleRate === 16000 || input.length === 0) {
    return input
  }
  const ratio = inputSampleRate / 16000
  const outLen = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.min(input.length - 1, Math.floor(i * ratio))
    out[i] = input[srcIdx]!
  }
  return out
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  return uint8ToBase64(new Uint8Array(buffer))
}

export function int16PcmToBase64(pcm: Int16Array): string {
  return uint8ToBase64(
    new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength),
  )
}

export function base64ToInt16Array(b64: string): Int16Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  if (bytes.byteLength % 2 !== 0) {
    throw new Error("Invalid PCM base64: odd byte length")
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
}

/**
 * Schedule PCM playback on the given context; queues chunks back-to-back.
 * `sampleRate` should match the stream (e.g. 24000 for Live API output).
 */
export function playPcm16(
  data: Int16Array,
  sampleRate: number,
  ctx: AudioContext,
  nextPlayTimeRef: { current: number },
): AudioBufferSourceNode {
  const float32 = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) {
    float32[i] = data[i]! / 32768
  }
  const buffer = ctx.createBuffer(1, float32.length, sampleRate)
  buffer.copyToChannel(float32, 0)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current)
  src.start(startAt)
  nextPlayTimeRef.current = startAt + buffer.duration
  return src
}

export function parsePcmMimeRate(mimeType: string | undefined): number {
  if (!mimeType) return 24000
  const m = /rate=(\d+)/i.exec(mimeType)
  if (m?.[1]) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return 24000
}
