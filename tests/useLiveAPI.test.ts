import { act, renderHook } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { useLiveAPI } from "../app/hooks/useLiveAPI"
import { getLiveToken } from "../app/lib/api"

vi.mock("../app/lib/api", () => ({ getLiveToken: vi.fn() }))

class FakeSocket {
  static OPEN = 1
  static latest: FakeSocket
  readyState = 1
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  send = vi.fn()
  close = vi.fn()
  constructor(public url: string) { FakeSocket.latest = this }
  emit(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }) }
}
const stopTrack = vi.fn()
const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0 }, onaudioprocess: null })
class FakeAudio {
  currentTime = 0
  sampleRate = 16000
  resume = vi.fn().mockResolvedValue(undefined)
  close = vi.fn().mockResolvedValue(undefined)
  createMediaStreamSource = node
  createScriptProcessor = node
  createGain = node
}
beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket)
  vi.stubGlobal("AudioContext", FakeAudio)
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
  } })
  vi.mocked(getLiveToken).mockResolvedValue({ token: "auth_tokens/temporary", model: "test-model" })
  stopTrack.mockClear()
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

async function connectedHook() {
  const complete = vi.fn()
  const error = vi.fn()
  const hook = renderHook(() => useLiveAPI({ questions: ["First?", "Second?"], rubric: "Be specific",
    onInterviewComplete: complete, onError: error }))
  await act(() => hook.result.current.startSession())
  act(() => {
    FakeSocket.latest.onopen?.()
    FakeSocket.latest.emit({ setupComplete: {} })
    FakeSocket.latest.emit({ toolCall: { functionCalls: [{ id: "q1", name: "set_question", args: { question_index: 0 } }] } })
    FakeSocket.latest.emit({ serverContent: { inputTranscription: { text: "I built a tested service." } } })
  })
  return { ...hook, complete, error }
}

it("retains answers when manually stopped, disconnected, and unmounted", async () => {
  const hook = await connectedHook()
  expect(FakeSocket.latest.url).toContain("access_token=auth_tokens")
  act(() => hook.result.current.stopSession())
  expect(hook.result.current.getRecording().answers[0].text).toBe("I built a tested service.")
  expect(stopTrack).toHaveBeenCalled()
  hook.unmount()
})

it("automatic completion preserves the transcript before invoking the callback", async () => {
  const hook = await connectedHook()
  vi.useFakeTimers()
  act(() => FakeSocket.latest.emit({ toolCall: { functionCalls: [{ id: "end", name: "end_interview" }] } }))
  act(() => vi.advanceTimersByTime(2000))
  expect(hook.complete).toHaveBeenCalledTimes(1)
  expect(hook.result.current.getRecording().answers[0].text).toBe("I built a tested service.")
  hook.unmount()
})

it("keeps disconnected recordings and reports a recoverable error", async () => {
  const hook = await connectedHook()
  act(() => FakeSocket.latest.onclose?.())
  expect(hook.error).toHaveBeenCalledWith(expect.stringContaining("preserved"))
  expect(hook.result.current.getRecording().answers[0].text).toContain("tested service")
  hook.unmount()
})

it("stops a microphone permission request that resolves after cancellation", async () => {
  let resolveMic!: (value: unknown) => void
  const deferred = new Promise((resolve) => { resolveMic = resolve })
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(deferred as Promise<MediaStream>)
  const hook = renderHook(() => useLiveAPI({ questions: ["First?"], rubric: "test", onError: vi.fn(), onInterviewComplete: vi.fn() }))
  let starting!: Promise<void>
  await act(async () => { starting = hook.result.current.startSession(); await Promise.resolve() })
  act(() => hook.result.current.stopSession())
  await act(async () => {
    resolveMic({ getTracks: () => [{ stop: stopTrack }] })
    await starting
  })
  expect(stopTrack).toHaveBeenCalled()
  expect(hook.result.current.isConnected).toBe(false)
  hook.unmount()
})
