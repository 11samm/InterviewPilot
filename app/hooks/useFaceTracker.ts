"use client"

import { useCallback, useRef, useState } from "react"
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision"
import type { FaceMetric } from "@/app/lib/api"

const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"

/** MediaPipe 478-point face mesh indices (see MediaPipe docs) */
const NOSE_TIP = 4
const NOSE_ROOT = 1
const CHIN = 152
const LEFT_EYE_INNER = 133
const LEFT_EYE_OUTER = 33
const RIGHT_EYE_INNER = 263
const RIGHT_EYE_OUTER = 362
const LEFT_IRIS_CENTER = 468
const RIGHT_IRIS_CENTER = 473

function vecDist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function computeMetricsFromLandmarks(landmarks: NormalizedLandmark[]): {
  eye_contact: number
  head_pitch: number
  head_yaw: number
} {
  if (landmarks.length < 478) {
    return { eye_contact: 0.5, head_pitch: 0, head_yaw: 0 }
  }

  const get = (i: number) => landmarks[i]!

  // Eye contact: when looking at camera, iris centers align with eye centers.
  // Score = 1 when irises are centered in eyes, 0 when looking away.
  const leftIris = get(LEFT_IRIS_CENTER)
  const rightIris = get(RIGHT_IRIS_CENTER)
  const leftEyeInner = get(LEFT_EYE_INNER)
  const leftEyeOuter = get(LEFT_EYE_OUTER)
  const rightEyeInner = get(RIGHT_EYE_INNER)
  const rightEyeOuter = get(RIGHT_EYE_OUTER)

  const leftEyeWidth = vecDist(leftEyeInner, leftEyeOuter) || 0.01
  const rightEyeWidth = vecDist(rightEyeInner, rightEyeOuter) || 0.01
  const leftEyeCenterX = (leftEyeInner.x + leftEyeOuter.x) / 2
  const rightEyeCenterX = (rightEyeInner.x + rightEyeOuter.x) / 2

  const leftOffset = Math.abs(leftIris.x - leftEyeCenterX) / leftEyeWidth
  const rightOffset = Math.abs(rightIris.x - rightEyeCenterX) / rightEyeWidth
  const avgOffset = (leftOffset + rightOffset) / 2
  const eye_contact = Math.max(0, Math.min(1, 1 - avgOffset * 2))

  // Head pitch: vertical angle (nod up/down). Nose-to-chin vector.
  const noseTip = get(NOSE_TIP)
  const noseRoot = get(NOSE_ROOT)
  const chin = get(CHIN)
  const faceVertical = chin.y - noseRoot.y
  const noseToChin = chin.y - noseTip.y
  const head_pitch = faceVertical !== 0 ? (noseToChin / faceVertical) * 30 : 0

  // Head yaw: horizontal angle (turn left/right). Nose x offset from center 0.5.
  const head_yaw = (noseTip.x - 0.5) * 60
  return { eye_contact, head_pitch, head_yaw }
}

export interface UseFaceTrackerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  eyeContactScore: number
  getFaceMetrics: () => FaceMetric[]
  startTracking: () => Promise<void>
  stopTracking: () => void
}

export function useFaceTracker(): UseFaceTrackerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [eyeContactScore, setEyeContactScore] = useState(0)
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const metricsRef = useRef<FaceMetric[]>([])
  const recentScoresRef = useRef<number[]>([])
  const lastVideoTimeRef = useRef<number>(-1)
  const sessionStartRef = useRef<number>(0)
  const lastMetricPushRef = useRef<number>(0)
  const lastInferenceRef = useRef<number>(0)
  const INFERENCE_INTERVAL_MS = 200

  const getFaceMetrics = useCallback((): FaceMetric[] => {
    return [...metricsRef.current]
  }, [])

  const stopTracking = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    faceLandmarkerRef.current?.close()
    faceLandmarkerRef.current = null
    setEyeContactScore(0)
  }, [])

  const startTracking = useCallback(async () => {
    stopTracking()
    metricsRef.current = []
    recentScoresRef.current = []
    lastVideoTimeRef.current = -1
    sessionStartRef.current = Date.now() / 1000

    const video = videoRef.current
    if (!video) return

    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    streamRef.current = stream
    video.srcObject = stream
    await video.play()

    const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
    const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
      runningMode: "VIDEO",
      numFaces: 1,
    })
    faceLandmarkerRef.current = faceLandmarker

    const runDetection = () => {
      const v = videoRef.current
      const fl = faceLandmarkerRef.current
      if (!v || !fl || v.readyState < 2) {
        rafRef.current = requestAnimationFrame(runDetection)
        return
      }
      const time = v.currentTime
      const nowMs = Date.now()
      if (
        time !== lastVideoTimeRef.current &&
        nowMs - lastInferenceRef.current >= INFERENCE_INTERVAL_MS
      ) {
        lastVideoTimeRef.current = time
        lastInferenceRef.current = nowMs
        try {
          const result: FaceLandmarkerResult = fl.detectForVideo(v, time * 1000)
          const faces = result.faceLandmarks ?? []
          if (faces.length > 0) {
            const { eye_contact, head_pitch, head_yaw } = computeMetricsFromLandmarks(
              faces[0]!
            )
            recentScoresRef.current.push(eye_contact)
            if (nowMs - lastMetricPushRef.current >= 1000) {
              lastMetricPushRef.current = nowMs
              const ts = sessionStartRef.current + time
              metricsRef.current.push({
                timestamp: ts,
                eye_contact,
                head_pitch,
                head_yaw,
              })
            }
            if (recentScoresRef.current.length > 25) {
              recentScoresRef.current.shift()
            }
            const avg =
              recentScoresRef.current.reduce((a, b) => a + b, 0) /
              Math.max(1, recentScoresRef.current.length)
            setEyeContactScore(avg)
          }
        } catch {
          /* ignore single-frame errors */
        }
      }
      rafRef.current = requestAnimationFrame(runDetection)
    }
    rafRef.current = requestAnimationFrame(runDetection)
  }, [stopTracking])

  return {
    videoRef,
    eyeContactScore,
    getFaceMetrics,
    startTracking,
    stopTracking,
  }
}
