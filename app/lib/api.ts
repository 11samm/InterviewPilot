export interface SetupInput {
  role: string; style: string; vibe: string; difficulty: string; num_questions?: number
}
export interface PlanOutput { questions: string[]; rubric: string }
export interface FaceMetric { timestamp: number; eye_contact: number; head_pitch: number; head_yaw: number }
export interface AnswerInput { question_index: number; asked: boolean; text: string; speaking_seconds: number }
export interface AnalyzeInput {
  interview_id: string; questions: string[]; rubric: string; answers: AnswerInput[]
  duration_seconds: number; face_metrics: FaceMetric[]
}
export interface PresenceScore { available: boolean; sample_count: number; eye_contact_score: number | null }
export interface SpeechScore {
  filler_count: number; filler_words: string[]; word_count: number
  speaking_seconds: number; speech_pace_wpm: number | null
}
export interface QuestionResult {
  question_index: number; question: string; answer: string
  status: "graded" | "unanswered" | "not_asked"; score: number | null; evidence: string; feedback: string
}
export interface CoachOutput {
  question_results: QuestionResult[]; overall_score: number | null
  strengths: string[]; improvements: string[]; summary: string
}
export interface AnalyzeOutput { presence: PresenceScore; speech: SpeechScore; coaching: CoachOutput }
export interface DeepDiveOutput { exercise: string; tips: string[]; example_answer: string }
export interface InterviewSummary {
  id: string; created_at: number; question_count: number
  overall_score: number | null; status: "complete" | "pending"; speech: SpeechScore | null
}
export interface SavedInterview { id: string; created_at: number; payload: AnalyzeInput; result: AnalyzeOutput | null }

export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api" + path, {
    method, credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please retry.`
    try {
      const error = await response.json()
      if (typeof error.detail === "string") message = error.detail
      else if (Array.isArray(error.detail)) message = "Some interview data is invalid. Please check the recording and retry."
    } catch { /* Non-JSON proxy error: preserve a useful status without exposing an HTML page. */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : response.json()
}
export const sessionStatus = () => request<{ authenticated: boolean; access_code_required: boolean }>("/session")
export const openSession = (access_code = "") => request("/session", "POST", { access_code })
export const planInterview = (input: SetupInput) => request<PlanOutput>("/plan", "POST", input)
export const analyzeInterview = (input: AnalyzeInput) => request<AnalyzeOutput>("/analyze", "POST", input)
export const deepDiveInterview = (input: { transcript: string; weakness: string }) => request<DeepDiveOutput>("/deepdive", "POST", input)
export const getLiveToken = () => request<{ token: string; model: string }>("/live-token", "POST")
export const listInterviews = () => request<InterviewSummary[]>("/interviews")
export const getInterview = (id: string) => request<SavedInterview>(`/interviews/${id}`)
export const saveDraft = (input: AnalyzeInput) => request(`/interviews/${input.interview_id}`, "PUT", input)
export const deleteInterview = (id: string) => request(`/interviews/${id}`, "DELETE")
