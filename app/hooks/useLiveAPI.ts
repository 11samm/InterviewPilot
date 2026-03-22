"use client"

import { useCallback, useRef, useState } from "react"
import {
  base64ToInt16Array,
  float32ToPcm16,
  int16PcmToBase64,
  parsePcmMimeRate,
  playPcm16,
  resampleFloat32To16k,
} from "@/app/lib/audioUtils"

/** v1beta Bidi (Live) — resource id without `models/` prefix (prepended in setup). */
const MODEL_NAME = "gemini-2.5-flash-native-audio-preview-12-2025"

/**
 * v1beta Bidi WebSocket — append exactly one `?key=...` (base path must not contain `?`).
 * Use the native-audio Live model from the current WebSocket guide (older ids like
 * gemini-2.0-flash-live-001 return 1008 “not found / not supported for bidiGenerateContent”).
 * @see https://ai.google.dev/api/live
 * @see https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket
 */
const WSS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"

/** Let closing audio play before we tear down (tool call + auto-goodbye). */
const INTERVIEW_HANDOFF_DELAY_MS = 3000

function buildLiveWebSocketUrl(apiKey: string): string {
  const key = apiKey.trim()
  const base = WSS_URL.split("?")[0]?.replace(/\/$/, "") ?? WSS_URL
  return `${base}?key=${encodeURIComponent(key)}`
}

/** Decode server frames when `binaryType` is `arraybuffer` (UTF-8 JSON). */
function messageEventDataToUtf8(data: MessageEvent["data"]): string {
  if (typeof data === "string") {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder("utf-8", { fatal: false }).decode(data)
  }
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    return new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(
        view.buffer,
        view.byteOffset,
        view.byteLength,
      ),
    )
  }
  return ""
}

const LIVE_DEBUG =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_LIVE_API_DEBUG === "true"

function liveLog(...args: unknown[]) {
  if (LIVE_DEBUG) {
    console.info("[InterviewPilot Live]", ...args)
  }
}

export type UseLiveAPIOptions = {
  apiKey: string
  questions: string[]
  rubric: string
  onInterviewComplete: () => void
  onError: (message: string) => void
}

function buildSystemInstruction(questions: string[], rubric: string): string {
  const q1 = questions[0] ?? ""
  const q2 = questions[1] ?? ""
  return `You are a strict, professional interviewer running a structured mock interview.

SCRIPT — follow this exactly, word for word:
1. Greet the candidate in exactly ONE sentence (e.g. "Hi, I'm your AI interviewer today.")
2. Ask: "${q1}" — wait silently for their full answer.
3. Say one sentence of acknowledgment (do NOT ask follow-ups).
4. Ask: "${q2}" — wait silently for their full answer.
5. Say exactly: "Thank you, that concludes our interview. Good luck!"
6. CALL end_interview() IMMEDIATELY. Do not speak any more words after calling it.

RULES:
- You MUST call end_interview() after step 5. This is mandatory, not optional.
- Do not add questions, comments, or extra sentences beyond the script.
- The session starts with the candidate listening and silent. Begin speaking immediately with step 1 (your greeting) and continue into step 2 (question 1) in the same opening turn — do not wait for them to talk first.
- Rubric (context only, do not read aloud): ${rubric}`
}

/** Prompt the model to open the interview; native-audio Live often waits for client input otherwise. */
function sendInterviewKickoff(ws: WebSocket) {
  if (ws.readyState !== WebSocket.OPEN) return
  try {
    ws.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: "I'm here and listening. Please start the interview.",
                },
              ],
            },
          ],
          turnComplete: true,
        },
      }),
    )
  } catch {
    /* ignore */
  }
}

// Helper to extract Gemini's server-side transcript from a message
function extractOutputTranscription(msg: unknown): string {
  if (!msg || typeof msg !== "object") return ""
  const o = msg as Record<string, unknown>
  const sc = (o.serverContent ?? o.server_content) as
    | Record<string, unknown>
    | undefined
  if (!sc) return ""
  const ot = (sc.outputTranscription ?? sc.output_transcription) as
    | { text?: string }
    | undefined
  return ot?.text ?? ""
}

function collectEndInterviewCalls(
  root: unknown,
): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  const visit = (node: unknown) => {
    if (node === null || node === undefined) return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (typeof node !== "object") return
    const o = node as Record<string, unknown>
    const fcs = o.functionCalls ?? o.function_calls
    if (Array.isArray(fcs)) {
      for (const fc of fcs as { id?: string; name?: string }[]) {
        if (fc?.name === "end_interview") {
          const id =
            fc.id != null && String(fc.id).length > 0
              ? String(fc.id)
              : `end_interview_${out.length}`
          out.push({ id, name: "end_interview" })
        }
      }
    }
    for (const v of Object.values(o)) visit(v)
  }
  visit(root)
  return out
}

function forEachModelAudioPart(
  msg: unknown,
  fn: (data: string, mimeType?: string) => void,
): void {
  const visit = (node: unknown) => {
    if (node === null || node === undefined) return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (typeof node !== "object") return
    const o = node as Record<string, unknown>
    const modelTurn =
      (o.modelTurn ?? o.model_turn) as Record<string, unknown> | undefined
    const parts = modelTurn?.parts
    if (Array.isArray(parts)) {
      for (const part of parts as Record<string, unknown>[]) {
        const inline = (part.inlineData ?? part.inline_data) as
          | Record<string, unknown>
          | undefined
        if (inline?.data && typeof inline.data === "string") {
          const mime = (inline.mimeType ?? inline.mime_type) as
            | string
            | undefined
          fn(inline.data, mime)
        }
      }
    }
    for (const v of Object.values(o)) visit(v)
  }
  visit(msg)
}

function hasGenerationComplete(msg: unknown): boolean {
  const visit = (node: unknown): boolean => {
    if (node === null || node === undefined) return false
    if (Array.isArray(node)) return node.some(visit)
    if (typeof node !== "object") return false
    const o = node as Record<string, unknown>
    if (o.generationComplete === true || o.generation_complete === true) {
      return true
    }
    return Object.values(o).some(visit)
  }
  return visit(msg)
}

/** Server ack for BidiGenerateContentSetup — wait before streaming realtime input. */
function isSetupCompleteMessage(msg: unknown): boolean {
  if (!msg || typeof msg !== "object") return false
  const o = msg as Record<string, unknown>
  return "setup_complete" in o || "setupComplete" in o
}

function logIfServerErrorPayload(msg: unknown) {
  if (!msg || typeof msg !== "object") return
  const o = msg as Record<string, unknown>
  if ("error" in o) {
    console.error("[InterviewPilot Live] server payload includes error:", o.error)
  }
}

export function useLiveAPI(options: UseLiveAPIOptions) {
  const optsRef = useRef(options)
  optsRef.current = options

  const [isConnected, setIsConnected] = useState(false)
  const [isGeminiSpeaking, setIsGeminiSpeaking] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const inputCtxRef = useRef<AudioContext | null>(null)
  const outputCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const nextPlayTimeRef = useRef({ current: 0 })
  const endedRef = useRef(false)
  const isSetupSentRef = useRef(false)
  const setupCompleteReceivedRef = useRef(false)
  const realtimeCaptureReadyRef = useRef(false)
  const captureStartRequestedRef = useRef(false)
  const setupWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inboundLogCountRef = useRef(0)
  const geminiTranscriptRef = useRef<string>("")
  const toolHandoffDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goodbyeAutoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const micPromiseRef = useRef<Promise<MediaStream> | null>(null)
  /** Bumped on every teardown so Strict Mode / remounts don't treat aborted sockets as failures. */
  const liveSessionGenerationRef = useRef(0)

  const cleanupAudio = useCallback(() => {
    try {
      processorRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    processorRef.current = null

    try {
      sourceRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    sourceRef.current = null

    try {
      gainRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    gainRef.current = null

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null

    void inputCtxRef.current?.close().catch(() => {})
    inputCtxRef.current = null

    void outputCtxRef.current?.close().catch(() => {})
    outputCtxRef.current = null

    nextPlayTimeRef.current = { current: 0 }
  }, [])

  const teardownConnection = useCallback(() => {
    liveSessionGenerationRef.current += 1
    if (setupWaitTimeoutRef.current != null) {
      clearTimeout(setupWaitTimeoutRef.current)
      setupWaitTimeoutRef.current = null
    }
    if (toolHandoffDelayRef.current != null) {
      clearTimeout(toolHandoffDelayRef.current)
      toolHandoffDelayRef.current = null
    }
    if (goodbyeAutoEndTimeoutRef.current != null) {
      clearTimeout(goodbyeAutoEndTimeoutRef.current)
      goodbyeAutoEndTimeoutRef.current = null
    }
    isSetupSentRef.current = false
    setupCompleteReceivedRef.current = false
    realtimeCaptureReadyRef.current = false
    captureStartRequestedRef.current = false
    inboundLogCountRef.current = 0
    geminiTranscriptRef.current = ""
    setIsConnected(false)
    setIsGeminiSpeaking(false)
    try {
      wsRef.current?.close()
    } catch {
      /* ignore */
    }
    wsRef.current = null
    cleanupAudio()
  }, [cleanupAudio])

  const stopSession = useCallback(() => {
    endedRef.current = true
    teardownConnection()
  }, [teardownConnection])

  const handleEndInterview = useCallback(
    (ws: WebSocket, calls: { id: string; name: string }[]) => {
      if (endedRef.current) return
      endedRef.current = true

      const functionResponses = calls.map((c) => ({
        id: c.id,
        name: c.name,
        response: { result: "ok" },
      }))

      try {
        ws.send(
          JSON.stringify({
            toolResponse: {
              functionResponses,
            },
          }),
        )
      } catch {
        /* ignore */
      }

      teardownConnection()

      try {
        optsRef.current.onInterviewComplete()
      } catch (e) {
        optsRef.current.onError(
          e instanceof Error ? e.message : "onInterviewComplete failed",
        )
      }
    },
    [teardownConnection],
  )

  const startSession = useCallback(async () => {
    const { apiKey, questions, rubric, onError } = optsRef.current

    const trimmedKey = apiKey.trim()
    if (!trimmedKey || trimmedKey === "your_api_key_here") {
      onError(
        "Missing NEXT_PUBLIC_GEMINI_API_KEY. Add your key to .env.local for Live API.",
      )
      return
    }

    teardownConnection()
    // Pre-create AudioContexts NOW — we are still inside the user gesture call stack.
    // AudioContext created inside onmessage (async) is blocked by browser autoplay policy.
    const preOutputCtx = new AudioContext({ sampleRate: 24000 })
    const preInputCtx = new AudioContext({ sampleRate: 16000 })
    outputCtxRef.current = preOutputCtx
    inputCtxRef.current = preInputCtx
    nextPlayTimeRef.current = { current: 0 }

    endedRef.current = false
    isSetupSentRef.current = false
    setupCompleteReceivedRef.current = false
    realtimeCaptureReadyRef.current = false
    captureStartRequestedRef.current = false
    inboundLogCountRef.current = 0

    const sessionGeneration = liveSessionGenerationRef.current

    // Fire the getUserMedia request NOW — within the user gesture context.
    // This makes the browser permission dialog appear immediately instead of
    // 2-5 seconds later when setup_complete arrives. The mic and WebSocket
    // handshake now happen in parallel, not sequentially.
    micPromiseRef.current = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    })
    // Do not await — let it race with WebSocket setup

    // In React 18 Strict Mode (dev), effect cleanup runs right after the effect
    // returns. Defer opening the socket so that first-pass cleanup can bump
    // `liveSessionGenerationRef` without ever creating a WebSocket to close
    // (avoids the browser console error: closed before connection established).
    await Promise.resolve()
    if (liveSessionGenerationRef.current !== sessionGeneration) {
      // Superseded by Strict Mode remount — close the pre-created contexts
      void preOutputCtx.close().catch(() => {})
      void preInputCtx.close().catch(() => {})
      if (outputCtxRef.current === preOutputCtx) outputCtxRef.current = null
      if (inputCtxRef.current === preInputCtx) inputCtxRef.current = null
      micPromiseRef.current
        ?.then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => {})
      micPromiseRef.current = null
      return
    }

    const wsUrl = buildLiveWebSocketUrl(trimmedKey)
    console.log("Connecting to:", wsUrl.split("key=")[0] + "key=HIDDEN")

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      onError(
        e instanceof Error ? e.message : "Could not open WebSocket connection.",
      )
      return
    }

    ws.binaryType = "arraybuffer"
    wsRef.current = ws

    const beginRealtimeCapture = async () => {
      // Reuse AudioContexts pre-created in startSession() (user gesture context)
      const outputCtx = outputCtxRef.current
      const inputCtx = inputCtxRef.current
      if (!outputCtx || !inputCtx) {
        throw new Error("AudioContexts not initialized — startSession() must be called first.")
      }

      // Resume suspended contexts (they start suspended when created outside playback)
      await outputCtx.resume()
      nextPlayTimeRef.current = { current: outputCtx.currentTime }

      // Await the mic request that was already started in startSession().
      // If the user hasn't granted permission yet, this awaits the dialog.
      // In most cases it's already resolved → zero additional delay.
      const stream = await (micPromiseRef.current ??
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        }))
      micPromiseRef.current = null
      mediaStreamRef.current = stream

      await inputCtx.resume()

      const source = inputCtx.createMediaStreamSource(stream)
      sourceRef.current = source

      // ScriptProcessorNode is deprecated but universally supported. AudioWorklet
      // would be the modern alternative but requires a separate processor file.
      const processor = inputCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (
          endedRef.current ||
          !setupCompleteReceivedRef.current ||
          !realtimeCaptureReadyRef.current
        ) {
          return
        }
        const active = wsRef.current
        if (!active || active.readyState !== WebSocket.OPEN) return
        const inputData = e.inputBuffer.getChannelData(0)
        // inputCtx.sampleRate is 16000 when browser honors the constraint;
        // resampleFloat32To16k is a no-op when inputSampleRate === 16000.
        const resampled = resampleFloat32To16k(inputData, inputCtx.sampleRate)
        const pcm = float32ToPcm16(resampled)
        const b64 = int16PcmToBase64(pcm)
        try {
          active.send(
            JSON.stringify({
              realtimeInput: {
                audio: { data: b64, mimeType: "audio/pcm;rate=16000" },
              },
            }),
          )
        } catch {
          /* ignore send errors — session may be closing */
        }
      }

      // Route processor through a silent gain node to satisfy the Web Audio graph
      // requirement (ScriptProcessorNode must be connected to destination).
      const silent = inputCtx.createGain()
      silent.gain.value = 0
      gainRef.current = silent
      source.connect(processor)
      processor.connect(silent)
      silent.connect(inputCtx.destination)
    }

    ws.onopen = () => {
      if (liveSessionGenerationRef.current !== sessionGeneration) {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        return
      }
      if (ws.readyState !== WebSocket.OPEN) {
        return
      }
      if (isSetupSentRef.current) {
        return
      }

      const systemInstruction = buildSystemInstruction(questions, rubric)
      /**
       * v1beta JSON uses camelCase field names (protobuf JSON mapping).
       * @see https://ai.google.dev/api/live — client keys: setup, realtimeInput, toolResponse
       */
      const setupMessage = {
        setup: {
          model: `models/${MODEL_NAME}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "end_interview",
                  description:
                    "Call this when both questions have been answered and you have said goodbye.",
                  parameters: {
                    type: "object",
                    properties: {},
                  },
                },
              ],
            },
          ],
        },
      }

      console.log("Outgoing Setup:", JSON.stringify(setupMessage))

      try {
        ws.send(JSON.stringify(setupMessage))
        isSetupSentRef.current = true
      } catch (e) {
        onError(
          e instanceof Error ? e.message : "Failed to send Live API setup.",
        )
        teardownConnection()
        endedRef.current = true
        return
      }

      setupWaitTimeoutRef.current = setTimeout(() => {
        if (liveSessionGenerationRef.current !== sessionGeneration) {
          return
        }
        if (
          !realtimeCaptureReadyRef.current &&
          wsRef.current === ws &&
          !endedRef.current
        ) {
          onError(
            "Live API did not send setup_complete before timeout. Check your key and model access.",
          )
          teardownConnection()
          endedRef.current = true
        }
      }, 20_000)
    }

    ws.onerror = (ev) => {
      if (liveSessionGenerationRef.current !== sessionGeneration) {
        liveLog("Ignoring ws.onerror for superseded Live session")
        return
      }
      liveLog("WebSocket error event:", ev)
      console.warn(
        "[InterviewPilot Live] ws.onerror — see console; often precedes an abnormal close.",
      )
      onError("Live API WebSocket error. Check your API key and network.")
    }

    ws.onclose = (ev) => {
      if (liveSessionGenerationRef.current !== sessionGeneration) {
        liveLog(
          "[InterviewPilot Live] Ignoring onclose for superseded session",
          ev.code,
        )
        return
      }
      const detail = {
        code: ev.code,
        reason: ev.reason || "(empty)",
        wasClean: ev.wasClean,
        readyStateWhenClosed: ws.readyState,
        setupSent: isSetupSentRef.current,
        setupCompleteSeen: setupCompleteReceivedRef.current,
        captureReady: realtimeCaptureReadyRef.current,
        sessionGeneration,
      }
      console.info("[InterviewPilot Live] WebSocket closed:", detail)
      liveLog("Full CloseEvent:", ev)
      setIsConnected(false)
      setIsGeminiSpeaking(false)
      if (!endedRef.current && ev.code !== 1000) {
        onError(
          `Live session closed (code ${ev.code}). Reason: ${ev.reason || "none"}. ` +
            `Open DevTools → Console for [InterviewPilot Live] logs. ` +
            `Set NEXT_PUBLIC_LIVE_API_DEBUG=true in .env.local for verbose traces.`,
        )
      }
    }

    ws.onmessage = (ev) => {
      if (liveSessionGenerationRef.current !== sessionGeneration) {
        return
      }
      const raw = messageEventDataToUtf8(ev.data)
      const rawByteHint =
        typeof ev.data === "string"
          ? `${raw.length} chars`
          : `decoded ~${raw.length} chars from binary`

      if (inboundLogCountRef.current < 8) {
        inboundLogCountRef.current += 1
        const preview =
          raw.length > 800 ? `${raw.slice(0, 800)}…(truncated)` : raw
        console.info(
          `[InterviewPilot Live] inbound #${inboundLogCountRef.current} (${rawByteHint}):`,
          preview || "(empty after decode)",
        )
      }
      liveLog("Inbound decoded length:", raw.length)

      let msg: unknown
      try {
        msg = raw ? JSON.parse(raw) : null
      } catch {
        console.warn(
          "[InterviewPilot Live] Non-JSON inbound frame (after UTF-8 decode):",
          raw.length > 200 ? `${raw.slice(0, 200)}…` : raw || "(empty)",
        )
        return
      }

      if (msg == null) {
        return
      }

      logIfServerErrorPayload(msg)

      const geminiText = extractOutputTranscription(msg)
      if (geminiText) {
        geminiTranscriptRef.current += geminiText + " "
        liveLog("Gemini said:", geminiText)
      }

      const rawEndEarly = collectEndInterviewCalls(msg)
      const seenIdsEarly = new Set<string>()
      const endCalls = rawEndEarly.filter((c) => {
        if (seenIdsEarly.has(c.id)) return false
        seenIdsEarly.add(c.id)
        return true
      })

      const GOODBYE_PHRASES = [
        "good luck",
        "best of luck",
        "take care",
        "goodbye",
        "good bye",
        "thank you for your time",
        "that concludes",
      ]
      const combined = geminiTranscriptRef.current.toLowerCase()
      const saidGoodbye = GOODBYE_PHRASES.some((p) => combined.includes(p))

      if (endCalls.length > 0) {
        if (goodbyeAutoEndTimeoutRef.current != null) {
          clearTimeout(goodbyeAutoEndTimeoutRef.current)
          goodbyeAutoEndTimeoutRef.current = null
        }
        if (toolHandoffDelayRef.current != null) {
          clearTimeout(toolHandoffDelayRef.current)
          toolHandoffDelayRef.current = null
        }
        const calls = endCalls
        toolHandoffDelayRef.current = setTimeout(() => {
          toolHandoffDelayRef.current = null
          if (liveSessionGenerationRef.current !== sessionGeneration) return
          if (endedRef.current) return
          handleEndInterview(ws, calls)
        }, INTERVIEW_HANDOFF_DELAY_MS)
      } else if (
        saidGoodbye &&
        hasGenerationComplete(msg) &&
        !endedRef.current &&
        toolHandoffDelayRef.current == null
      ) {
        if (goodbyeAutoEndTimeoutRef.current != null) return
        goodbyeAutoEndTimeoutRef.current = setTimeout(() => {
          goodbyeAutoEndTimeoutRef.current = null
          if (liveSessionGenerationRef.current !== sessionGeneration) return
          if (!endedRef.current) {
            liveLog(
              "Auto-triggering handoff: Gemini said goodbye without function call",
            )
            handleEndInterview(ws, [{ id: "auto_goodbye", name: "end_interview" }])
          }
        }, INTERVIEW_HANDOFF_DELAY_MS)
      }

      if (isSetupCompleteMessage(msg)) {
        setupCompleteReceivedRef.current = true
        if (!captureStartRequestedRef.current) {
          captureStartRequestedRef.current = true
          void beginRealtimeCapture()
            .then(() => {
              if (liveSessionGenerationRef.current !== sessionGeneration) {
                return
              }
              if (setupWaitTimeoutRef.current != null) {
                clearTimeout(setupWaitTimeoutRef.current)
                setupWaitTimeoutRef.current = null
              }
              realtimeCaptureReadyRef.current = true
              setIsGeminiSpeaking(true)
              setIsConnected(true)
              const active = wsRef.current
              if (active && active.readyState === WebSocket.OPEN) {
                sendInterviewKickoff(active)
              }
            })
            .catch((e) => {
              if (liveSessionGenerationRef.current !== sessionGeneration) {
                return
              }
              onError(
                e instanceof Error
                  ? e.message
                  : "Microphone or audio setup failed. Allow mic access and retry.",
              )
              teardownConnection()
              endedRef.current = true
            })
        }
      }

      if (hasGenerationComplete(msg)) {
        setIsGeminiSpeaking(false)
      }

      forEachModelAudioPart(msg, (b64, mimeType) => {
        if (endedRef.current) return
        setIsGeminiSpeaking(true)
        const ctx = outputCtxRef.current
        if (!ctx) return
        try {
          const pcm = base64ToInt16Array(b64)
          const rate = parsePcmMimeRate(mimeType)
          playPcm16(pcm, rate, ctx, nextPlayTimeRef.current)
        } catch {
          /* ignore bad chunk */
        }
      })
    }
  }, [handleEndInterview, teardownConnection])

  return {
    startSession,
    stopSession,
    isConnected,
    isGeminiSpeaking,
  }
}
