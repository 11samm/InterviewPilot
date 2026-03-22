"use client"

import { useCallback, useRef, useState } from "react"

type SpeechRecognitionWithWebkit = new () => SpeechRecognition

function getSpeechRecognitionCtor(): SpeechRecognitionWithWebkit | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionWithWebkit
    webkitSpeechRecognition?: SpeechRecognitionWithWebkit
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Browser SpeechRecognition in continuous mode for a silent transcript
 * parallel to Gemini Live audio (sent to /api/analyze later).
 */
export function useSpeechTranscription() {
  const transcriptRef = useRef("")
  const [transcript, setTranscript] = useState("")
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const resetTranscript = useCallback(() => {
    transcriptRef.current = ""
    setTranscript("")
  }, [])

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }

    const r = new Ctor()
    r.continuous = true
    r.interimResults = false
    r.lang = "en-US"
    r.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (!res?.isFinal) continue
        const piece = res[0]?.transcript?.trim()
        if (!piece) continue
        transcriptRef.current = transcriptRef.current
          ? `${transcriptRef.current} ${piece}`
          : piece
        setTranscript(transcriptRef.current)
      }
    }
    r.onerror = () => {
      /* unsupported or transient — keep accumulated text */
    }

    recognitionRef.current = r
    try {
      r.start()
    } catch {
      /* already started or not allowed */
    }
  }, [])

  const stopRecognition = useCallback((): string => {
    const r = recognitionRef.current
    recognitionRef.current = null
    if (r) {
      try {
        r.stop()
      } catch {
        /* ignore */
      }
      try {
        r.abort()
      } catch {
        /* ignore */
      }
    }
    return transcriptRef.current
  }, [])

  return {
    transcript,
    startRecognition,
    stopRecognition,
    resetTranscript,
  }
}
