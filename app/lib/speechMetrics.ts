export const FILLERS = ["you know", "i mean", "sort of", "kind of", "um", "uh", "erm", "hmm"]

export function speechMetrics(transcript: string, speakingSeconds: number) {
  const tokens = transcript.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []
  const found: string[] = []
  for (let i = 0; i < tokens.length;) {
    const phrase = FILLERS.find((filler) =>
      filler.split(" ").every((part, offset) => tokens[i + offset] === part))
    if (phrase) {
      found.push(phrase)
      i += phrase.split(" ").length
    } else i++
  }
  const seconds = Number.isFinite(speakingSeconds) && speakingSeconds > 0 ? speakingSeconds : 0
  return {
    filler_count: found.length,
    filler_words: [...new Set(found)].sort(),
    word_count: tokens.length,
    speaking_seconds: Math.round(seconds * 1000) / 1000,
    speech_pace_wpm: seconds >= 5 && tokens.length ? Math.round(tokens.length / seconds * 600) / 10 : null,
  }
}

/** Local audio-energy estimate; excludes playback and silence. This is not calibrated VAD. */
export function activeAudioSeconds(samples: Float32Array, sampleRate: number, modelPlaying: boolean): number {
  if (modelPlaying || samples.length === 0 || sampleRate <= 0) return 0
  const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
  return rms >= 0.015 ? samples.length / sampleRate : 0
}
