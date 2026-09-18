import { describe, expect, it } from "vitest"
import { activeAudioSeconds, speechMetrics } from "../app/lib/speechMetrics"
import { InterviewRecording } from "../app/lib/interviewRecording"

describe("speech measurements", () => {
  it("matches complete words and phrases without counting ordinary 'like' or substrings", () => {
    expect(speechMetrics("Um, you know, I mean: umbrella. I like TypeScript.", 10)).toEqual({
      filler_count: 3, filler_words: ["i mean", "um", "you know"],
      word_count: 9, speaking_seconds: 10, speech_pace_wpm: 54,
    })
  })
  it("does not manufacture pace without enough detected voice", () => {
    expect(speechMetrics("", 30).speech_pace_wpm).toBeNull()
    expect(speechMetrics("Hello world", 0).speech_pace_wpm).toBeNull()
    expect(speechMetrics("Hello world", 4.99).speech_pace_wpm).toBeNull()
    expect(speechMetrics("Hello world", 5).speech_pace_wpm).toBe(24)
  })
  it("does not count silent time or interviewer playback", () => {
    expect(activeAudioSeconds(new Float32Array(16000), 16000, false)).toBe(0)
    expect(activeAudioSeconds(new Float32Array(16000).fill(0.2), 16000, true)).toBe(0)
    expect(activeAudioSeconds(new Float32Array(16000).fill(0.2), 16000, false)).toBe(1)
  })
})

describe("question attribution", () => {
  it("captures every question and preserves detached snapshots", () => {
    const recording = new InterviewRecording(3)
    expect(recording.markQuestion(0)).toBe(true)
    recording.append("I built ")
    recording.append("a service.")
    recording.addSpeakingTime(6)
    const snapshot = recording.snapshot()
    expect(recording.markQuestion(1)).toBe(true)
    recording.append("I measured latency.")
    expect(snapshot[0].text).toBe("I built a service.")
    expect(snapshot[1].text).toBe("")
    expect(recording.snapshot()[1].text).toBe("I measured latency.")
    expect(recording.snapshot()[2].asked).toBe(false)
  })
  it("rejects invalid or skipped question events and ignores unassigned audio", () => {
    const recording = new InterviewRecording(3)
    recording.append("before interview")
    recording.addSpeakingTime(1)
    expect(recording.markQuestion(2)).toBe(false)
    expect(recording.markQuestion(NaN)).toBe(false)
    expect(recording.transcript).toBe("")
    expect(recording.speakingSeconds).toBe(0)
    expect(recording.markQuestion(0)).toBe(true)
    expect(recording.markQuestion(0)).toBe(true)
    expect(recording.markQuestion(1)).toBe(true)
    expect(recording.markQuestion(0)).toBe(false)
  })
})
