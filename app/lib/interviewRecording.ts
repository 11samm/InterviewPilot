import type { AnswerInput } from "./api"

export class InterviewRecording {
  answers: AnswerInput[]
  currentQuestionIndex = -1

  constructor(questionCount: number) {
    this.answers = Array.from({ length: questionCount }, (_, question_index) => ({
      question_index, asked: false, text: "", speaking_seconds: 0,
    }))
  }

  markQuestion(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.answers.length) return false
    // Repeated calls are idempotent; reject skips/backtracking instead of misattributing answers.
    if (index !== this.currentQuestionIndex && index !== this.currentQuestionIndex + 1) return false
    this.currentQuestionIndex = index
    this.answers[index].asked = true
    return true
  }

  append(text: string) {
    const answer = this.answers[this.currentQuestionIndex]
    if (answer) answer.text += text
  }

  addSpeakingTime(seconds: number) {
    const answer = this.answers[this.currentQuestionIndex]
    if (answer && Number.isFinite(seconds) && seconds > 0) answer.speaking_seconds += seconds
  }

  snapshot() {
    return this.answers.map((a) => ({ ...a, text: a.text.trim() }))
  }

  get transcript() { return this.snapshot().map((a) => a.text).filter(Boolean).join(" ") }
  get speakingSeconds() { return this.answers.reduce((sum, a) => sum + a.speaking_seconds, 0) }
}
