export interface SetupInput {
  role: string
  style: string
  vibe: string
  difficulty: string
  num_questions?: number
}

export interface PlanOutput {
  questions: string[]
  rubric: string
}

export interface FaceMetric {
  timestamp: number
  eye_contact: number
  head_pitch: number
  head_yaw: number
}

export interface AnalyzeInput {
  questions: string[]
  rubric: string
  transcript: string
  duration_seconds: number
  face_metrics: FaceMetric[]
}

export interface PresenceScore {
  eye_contact_score: number
  posture_score: number
  presence_score: number
}

export interface SpeechScore {
  filler_count: number
  filler_words: string[]
  word_count: number
  speech_pace_wpm: number
  speech_score: number
}

export interface CoachOutput {
  strengths: string[]
  improvements: string[]
  confidence_score: number
  summary: string
}

export interface AnalyzeOutput {
  presence: PresenceScore
  speech: SpeechScore
  coaching: CoachOutput
}

export interface DeepDiveInput {
  transcript: string
  weakness: string
}

export interface DeepDiveOutput {
  exercise: string
  tips: string[]
  example_answer: string
}

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  return raw.replace(/\/$/, "")
}

function errorMessageFromBody(text: string, status: number, statusText: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown }
    if (typeof j.detail === "string") return j.detail
  } catch {
    /* use raw text */
  }
  return text || `${status} ${statusText}`
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(errorMessageFromBody(text, res.status, res.statusText))
  }
  return res.json() as Promise<TResponse>
}

export async function planInterview(input: SetupInput): Promise<PlanOutput> {
  return postJson<PlanOutput>("/api/plan", input)
}

export async function analyzeInterview(input: AnalyzeInput): Promise<AnalyzeOutput> {
  return postJson<AnalyzeOutput>("/api/analyze", input)
}

export async function deepDiveInterview(input: DeepDiveInput): Promise<DeepDiveOutput> {
  return postJson<DeepDiveOutput>("/api/deepdive", input)
}
