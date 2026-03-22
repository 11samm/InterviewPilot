"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// TypeScript does not ship webkitSpeechRecognition types in strict lib.dom.d.ts.
// Declare a minimal interface so the compiler is satisfied without an @types package.
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}
interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}
interface SpeechRecognitionStatic {
  new (): SpeechRecognitionInstance
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic
    webkitSpeechRecognition?: SpeechRecognitionStatic
  }
}

export interface UseSpeechRecognitionReturn {
  startRecognition: () => void
  stopRecognition: () => void
  /** Returns the full accumulated transcript at any point. Uses a ref so always current. */
  getTranscript: () => string
  /** React state copy of the transcript — suitable for rendering. Updated on each final result. */
  liveTranscript: string
  isRecognizing: boolean
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const transcriptRef = useRef<string>("")  // source of truth — never stale
  const [liveTranscript, setLiveTranscript] = useState<string>("")
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false)

  // Stop on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
    }
  }, [])

  const startRecognition = useCallback(() => {
    const API: SpeechRecognitionStatic | undefined =
      window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!API) {
      // Safari < 14.1 and Firefox do not support SpeechRecognition.
      // The app degrades gracefully — transcript will be an empty string.
      console.warn(
        "[useSpeechRecognition] Web Speech API not available in this browser. Transcript will be empty.",
      )
      return
    }

    // Stop any in-progress recognition before starting fresh
    try { recognitionRef.current?.stop() } catch { /* ignore */ }

    // Reset transcript for new session
    transcriptRef.current = ""
    setLiveTranscript("")

    const recognition = new API()
    recognition.continuous = true       // keep listening across pauses
    recognition.interimResults = false  // only accumulate final (confirmed) results
    recognition.lang = "en-US"
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let newSegment = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i]?.isFinal) {
          newSegment += (event.results[i]?.[0]?.transcript ?? "") + " "
        }
      }
      if (newSegment.trim()) {
        transcriptRef.current += newSegment
        // Update React state for live display — throttled naturally by browser
        setLiveTranscript(transcriptRef.current.trim())
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" fires when the user is silent — expected during Gemini's turn.
      // "aborted" fires when we call stop() — also expected.
      // Do not surface these to the user.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[useSpeechRecognition] error:", event.error)
      }
    }

    recognition.onend = () => {
      setIsRecognizing(false)
    }

    try {
      recognition.start()
      setIsRecognizing(true)
    } catch (e) {
      console.warn("[useSpeechRecognition] start() threw:", e)
      setIsRecognizing(false)
    }
  }, [])

  const stopRecognition = useCallback(() => {
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    setIsRecognizing(false)
  }, [])

  const getTranscript = useCallback((): string => {
    // Read from ref, not state — this is always the latest value even in async callbacks
    return transcriptRef.current.trim()
  }, [])

  return { startRecognition, stopRecognition, getTranscript, liveTranscript, isRecognizing }
}
