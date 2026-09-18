"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  planInterview,
  analyzeInterview,
  deepDiveInterview,
  type AnalyzeOutput,
  type AnalyzeInput,
  type InterviewSummary,
  sessionStatus, openSession, listInterviews, getInterview, deleteInterview, saveDraft,
  type DeepDiveOutput,
  type FaceMetric,
  type PlanOutput,
  type SetupInput,
} from "@/app/lib/api"
import { speechMetrics } from "@/app/lib/speechMetrics"
import { InterviewHistory } from "@/app/components/InterviewHistory"
import { useFaceTracker } from "@/app/hooks/useFaceTracker"
import { useLiveAPI } from "@/app/hooks/useLiveAPI"
import {
  Briefcase,
  MessageSquare,
  Building2,
  Gauge,
  ChevronDown,
  Mic,
  Eye,
  Activity,
  Check,
  AlertTriangle,
  RotateCcw,
  Plane,
} from "lucide-react"

type ActiveView = "setup" | "interview" | "processing" | "results" | "review"

interface SelectOption {
  value: string
  label: string
}

const ROLE_PRESETS: SelectOption[] = [
  { value: "Software Engineer", label: "Software Engineer" },
  { value: "Product Manager", label: "Product Manager" },
  { value: "Data Scientist", label: "Data Scientist" },
]

const VIBE_PRESETS: SelectOption[] = [
  { value: "startup", label: "Startup" },
  { value: "big-tech", label: "Big Tech (FAANG)" },
  { value: "enterprise", label: "Enterprise" },
  { value: "agency", label: "Agency" },
]

function RoleCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="space-y-2" ref={rootRef}>
      <label className="text-sm text-muted-foreground flex items-center gap-2">
        <Briefcase className="h-4 w-4" />
        Role
      </label>
      <div className="relative flex rounded-lg border border-border bg-secondary focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select a role or type your own"
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none rounded-l-lg"
        />
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label="Toggle role suggestions"
          onClick={() => setIsOpen((o) => !o)}
          className="shrink-0 px-3 border-l border-border text-muted-foreground hover:text-foreground transition-colors rounded-r-lg"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && ROLE_PRESETS.length > 0 ? (
          <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            <div className="grid grid-cols-2 gap-0 max-h-48 overflow-y-auto">
            {ROLE_PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.label)
                  setIsOpen(false)
                }}
                className={`w-full px-4 py-3 text-left hover:bg-secondary transition-colors ${
                  value === option.label ? "text-primary bg-primary/10" : "text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Pick Software Engineer, Product Manager, Data Scientist, or enter any job title.
      </p>
    </div>
  )
}

function VibeCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const isPresetSelected = VIBE_PRESETS.some(
    (opt) => opt.label === value || opt.value === value,
  )
  const displayValue = isPresetSelected
    ? VIBE_PRESETS.find((opt) => opt.label === value || opt.value === value)?.label ?? value
    : value

  return (
    <div className="space-y-2" ref={rootRef}>
      <label className="text-sm text-muted-foreground flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        Company Vibe
      </label>
      <div className="relative flex rounded-lg border border-border bg-secondary focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Select a vibe or type your own"
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none rounded-l-lg"
        />
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label="Toggle vibe suggestions"
          onClick={() => setIsOpen((o) => !o)}
          className="shrink-0 px-3 border-l border-border text-muted-foreground hover:text-foreground transition-colors rounded-r-lg"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && VIBE_PRESETS.length > 0 ? (
          <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            <div className="grid grid-cols-2 gap-0 max-h-48 overflow-y-auto">
            {VIBE_PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.label)
                  setIsOpen(false)
                }}
                className={`w-full px-4 py-3 text-left hover:bg-secondary transition-colors ${
                  value === option.label || value === option.value
                    ? "text-primary bg-primary/10"
                    : "text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Pick Startup, Big Tech, Enterprise, Agency, or enter your own.
      </p>
    </div>
  )
}

// Custom Select Component
function CustomSelect({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: {
  label: string
  icon: React.ElementType
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div className="space-y-2" ref={selectRef}>
      <label className="text-sm text-muted-foreground flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary border border-border rounded-lg text-foreground hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <span>{selectedOption?.label || "Select..."}</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full px-4 py-3 text-left hover:bg-secondary transition-colors ${
                  value === option.value ? "text-primary bg-primary/10" : "text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Setup Screen
function SetupScreen({
  onStart,
  isStarting,
  onClientError,
}: {
  onStart: (setup: SetupInput) => void | Promise<void>
  isStarting: boolean
  onClientError: (message: string) => void
}) {
  const [role, setRole] = useState("Software Engineer")
  const [style, setStyle] = useState("behavioral")
  const [vibe, setVibe] = useState("startup")
  const [difficulty, setDifficulty] = useState("medium")
  const [numQuestions, setNumQuestions] = useState(2)

  const styleOptions: SelectOption[] = [
    { value: "behavioral", label: "Behavioral" },
    { value: "technical", label: "Technical" },
    { value: "case-study", label: "Case Study" },
    { value: "system-design", label: "System Design" },
  ]

  const difficultyOptions: SelectOption[] = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
    { value: "expert", label: "Expert" },
  ]

  const handleStart = () => {
    const trimmedRole = role.trim()
    if (!trimmedRole) {
      onClientError("Please enter or select a role.")
      return
    }
    void onStart({ role: trimmedRole, style, vibe, difficulty, num_questions: numQuestions })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Plane className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">InterviewPilot</h1>
          </div>
          <p className="text-muted-foreground">
            AI-powered mock interviews with real-time feedback
          </p>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-card border border-border rounded-xl p-6">
          <RoleCombobox value={role} onChange={setRole} />
          <CustomSelect
            label="Interview Style"
            icon={MessageSquare}
            options={styleOptions}
            value={style}
            onChange={setStyle}
          />
          <VibeCombobox value={vibe} onChange={setVibe} />
          <CustomSelect
            label="Difficulty"
            icon={Gauge}
            options={difficultyOptions}
            value={difficulty}
            onChange={setDifficulty}
          />
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Number of Questions
            </label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumQuestions(n)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    numQuestions === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:border-primary/50 border border-border"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              How many interview questions to ask.
            </p>
          </div>
        </div>

        {/* Start Button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={isStarting}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:pointer-events-none disabled:hover:scale-100"
        >
          {isStarting ? "Starting…" : "Start Interview"}
        </button>
      </div>
    </div>
  )
}

// Interview Screen (Live HUD)
function InterviewScreen({ plan, onEnd, onError }: {
  plan: PlanOutput
  onEnd: (payload: AnalyzeInput) => void | Promise<void>
  onError: (message: string) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const interviewId = useRef(crypto.randomUUID())
  const ending = useRef(false)
  const {
    startSession, stopSession, isConnected, isConnecting, isGeminiSpeaking,
    userTranscript, userSpeakingSeconds, currentQuestionIndex, getRecording,
  } = useLiveAPI({
    questions: plan.questions, rubric: plan.rubric,
    onInterviewComplete: () => { void submitHandoff() },
    onError,
  })
  const { videoRef, eyeContactScore, getFaceMetrics, startTracking, stopTracking } = useFaceTracker()
  const metrics = speechMetrics(userTranscript, userSpeakingSeconds)

  const submitHandoff = useCallback(async () => {
    if (ending.current) return
    ending.current = true
    setIsSubmitting(true)
    stopSession()
    stopTracking()
    const snapshot = getRecording()
    await onEnd({
      interview_id: interviewId.current, ...plan, ...snapshot, face_metrics: getFaceMetrics(),
    })
  }, [getRecording, getFaceMetrics, onEnd, plan, stopSession, stopTracking])

  useEffect(() => {
    if (!isConnected) return
    const timer = setInterval(() => setElapsedSeconds(Math.floor(getRecording().duration_seconds)), 500)
    return () => clearInterval(timer)
  }, [isConnected, getRecording])

  const start = () => {
    ending.current = false
    setIsSubmitting(false)
    setElapsedSeconds(0)
    interviewId.current = crypto.randomUUID()
    void startTracking().catch(() => onError("Camera tracking is unavailable. You can continue with voice only."))
    void startSession()
  }
  const hasRecording = currentQuestionIndex >= 0 || Boolean(userTranscript)
  return (
    <section className="min-h-screen p-6 space-y-6">
      <header className="flex justify-between items-center">
        <span className="font-semibold">InterviewPilot</span>
        <span className="text-sm text-muted-foreground">
          {isConnecting ? "Connecting…" : isConnected ? isGeminiSpeaking ? "Interviewer speaking" : "Listening" : "Session stopped"}
          {" · "}{Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
        </span>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="relative min-h-[420px] rounded-xl overflow-hidden border border-border bg-card">
          <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-background/90 p-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              {currentQuestionIndex >= 0 ? `Question ${currentQuestionIndex + 1} of ${plan.questions.length}` : "Waiting for the first question"}
            </p>
            <p className="text-lg">{currentQuestionIndex >= 0 ? plan.questions[currentQuestionIndex] : "Start when you are ready."}</p>
            {userTranscript && <p className="max-h-28 overflow-auto text-sm text-muted-foreground">{userTranscript}</p>}
          </div>
        </div>
        <aside className="space-y-4">
          <h2 className="font-semibold">Live metrics</h2>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Possible fillers</p>
            <p className="text-2xl font-bold">{metrics.filler_count}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Estimated speaking pace</p>
            <p className="text-2xl font-bold">{metrics.speech_pace_wpm ?? "—"} <span className="text-sm">WPM</span></p>
            <p className="text-xs text-muted-foreground">{userSpeakingSeconds.toFixed(1)} seconds of detected voice; at least 5 seconds needed.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Camera gaze estimate</p>
            <p className="text-2xl font-bold">{eyeContactScore === null ? "Unavailable" : `${Math.round(eyeContactScore * 100)}%`}</p>
            <p className="text-xs text-muted-foreground">Optional coaching signal; excluded from content grading.</p>
          </div>
        </aside>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {!isConnected && !isConnecting && !hasRecording && (
          <button onClick={start} className="rounded-xl bg-primary px-6 py-3 text-primary-foreground">Start Live Session</button>
        )}
        {isConnecting && <button onClick={() => { stopSession(); stopTracking() }} className="rounded-xl border px-6 py-3">Cancel connection</button>}
        {hasRecording && !isSubmitting && (
          <button onClick={() => void submitHandoff()} className="rounded-xl bg-primary px-6 py-3 text-primary-foreground">
            {isConnected ? "Finish and analyze" : "Save recording and analyze"}
          </button>
        )}
        {isSubmitting && <p role="status">Saving your recording…</p>}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Microphone audio is sent to Gemini. Camera images stay in your browser. Transcripts and reports are saved on the app server.
      </p>
    </section>
  )
}

// Processing Screen
function ProcessingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="relative">
        <div className="w-24 h-24 border-4 border-secondary rounded-full"></div>
        <div className="absolute top-0 left-0 w-24 h-24 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-8 h-8 bg-primary/30 rounded-full animate-pulse"></div>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Analyzing your interview…</h2>
        <p className="text-muted-foreground">Sending responses to the coach service</p>
      </div>
    </div>
  )
}

// Results Screen
function ResultsScreen({
  results,
  transcript,
  onRetry,
}: {
  results: AnalyzeOutput
  transcript: string
  onRetry: () => void
}) {
  const { coaching } = results
  const score = coaching.overall_score
  const strengths = coaching.strengths
  const improvements = coaching.improvements

  const [drillError, setDrillError] = useState<string | null>(null)
  const [deepDives, setDeepDives] = useState<Record<number, DeepDiveOutput | null>>({})
  const [deepDiveLoading, setDeepDiveLoading] = useState<Record<number, boolean>>({})

  const handleDeepDive = async (weakness: string, index: number) => {
    setDrillError(null)
    setDeepDiveLoading((prev) => ({ ...prev, [index]: true }))
    try {
      const result = await deepDiveInterview({ transcript, weakness })
      setDeepDives((prev) => ({ ...prev, [index]: result }))
    } catch (error) {
      setDrillError(error instanceof Error ? error.message : "Could not load the drill. Please retry.")
    } finally {
      setDeepDiveLoading((prev) => ({ ...prev, [index]: false }))
    }
  }

  const handleRetry = () => {
    onRetry()
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6 py-12">
      {/* Score */}
      <div className="text-center mb-12">
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
          Interview content score
        </p>
        <div className="relative">
          <span className="text-8xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {score ?? "—"}
          </span>
          <span className="text-3xl text-muted-foreground">/100</span>
        </div>
        {coaching.summary ? (
          <p className="mt-6 max-w-xl mx-auto text-muted-foreground leading-relaxed text-balance">
            {coaching.summary}
          </p>
        ) : null}
      </div>

      <section className="w-full max-w-4xl mb-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          Content score is the mean of asked-question scores. Asked questions with no captured answer count as zero;
          questions not reached are excluded. Speech and camera estimates do not affect this score.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-4"><p>Possible fillers</p><strong className="text-2xl">{results.speech.filler_count}</strong>
            <p className="text-xs text-muted-foreground">{results.speech.filler_words.join(", ") || "None detected in the transcript"}</p></div>
          <div className="rounded-xl border p-4"><p>Estimated pace</p><strong className="text-2xl">{results.speech.speech_pace_wpm ?? "Unavailable"}</strong>
            <p className="text-xs text-muted-foreground">WPM · {results.speech.word_count} words · {results.speech.speaking_seconds.toFixed(1)} voice seconds</p></div>
          <div className="rounded-xl border p-4"><p>Camera gaze estimate</p><strong className="text-2xl">
            {results.presence.eye_contact_score === null ? "Unavailable" : `${Math.round(results.presence.eye_contact_score * 100)}%`}</strong>
            <p className="text-xs text-muted-foreground">{results.presence.sample_count} samples; approximate camera alignment</p></div>
        </div>
        <p className="text-xs text-muted-foreground">Pace uses microphone energy to estimate speaking time. Transcription may omit fillers; background noise may affect timing.</p>
        <h2 className="text-xl font-semibold">Question feedback</h2>
        {coaching.question_results.map((question) => <article key={question.question_index} className="rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold">{question.question_index + 1}. {question.question}</h3>
          <p className="text-primary">{question.score === null ? "Not reached" : `${question.score}/100`}</p>
          {question.evidence && <blockquote className="border-l-2 border-primary pl-3 text-muted-foreground">“{question.evidence}”</blockquote>}
          <p>{question.feedback}</p>
          <details><summary className="cursor-pointer text-sm text-muted-foreground">Captured answer</summary><p className="mt-2 text-sm">{question.answer || "No answer captured."}</p></details>
        </article>)}
      </section>

      {drillError && <p role="alert" className="mb-4 text-destructive">{drillError}</p>}
      {/* Feedback Grid */}
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 mb-12">
        {/* Strengths */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-accent flex items-center gap-2">
            <Check className="h-5 w-5" />
            Strengths
          </h3>
          <ul className="space-y-3">
            {strengths.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-muted-foreground">
                <Check className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Areas to Improve */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Areas to Improve
          </h3>
          <ul className="space-y-4">
            {improvements.map((item, i) => (
              <li key={i} className="flex flex-col gap-2 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeepDive(item, i)}
                  disabled={deepDiveLoading[i]}
                  className="self-start ml-8 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {deepDiveLoading[i] ? "Loading…" : "Deep Dive →"}
                </button>
                {deepDives[i] && (
                  <div className="ml-8 mt-3 bg-card border border-border rounded-xl p-5 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                        Exercise
                      </p>
                      <p className="text-sm text-foreground">{deepDives[i].exercise}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                        Tips
                      </p>
                      <ul className="space-y-1">
                        {deepDives[i].tips.map((tip, j) => (
                          <li key={j} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-primary shrink-0">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                        Example Answer
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {deepDives[i].example_answer}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Retry Button */}
      <button
        type="button"
        onClick={handleRetry}
        className="px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-all duration-300 flex items-center gap-2"
      >
        <RotateCcw className="h-5 w-5" />
        Start another interview
      </button>
    </div>
  )
}

// Main App Component
export default function InterviewPilot() {
  const [activeView, setActiveView] = useState<ActiveView>("setup")
  const [plan, setPlan] = useState<PlanOutput | null>(null)
  const [results, setResults] = useState<AnalyzeOutput | null>(null)
  const [transcript, setTranscript] = useState("")
  const [pending, setPending] = useState<AnalyzeInput | null>(null)
  const [history, setHistory] = useState<InterviewSummary[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [toastError, setToastError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [accessRequired, setAccessRequired] = useState(false)
  const [accessCode, setAccessCode] = useState("")
  const [connecting, setConnecting] = useState(false)

  const refreshHistory = useCallback(async () => { setHistory(await listInterviews()) }, [])
  const initialize = useCallback(async (code?: string) => {
    setConnecting(true)
    setToastError(null)
    try {
      const status = await sessionStatus()
      if (!status.authenticated) {
        if (status.access_code_required && code === undefined) { setAccessRequired(true); return }
        await openSession(code)
      }
      setReady(true)
      setAccessRequired(false)
      await refreshHistory()
      try {
        const value = sessionStorage.getItem("interviewpilot.pending.v1")
        if (value) {
          const draft = JSON.parse(value)
          if (draft.interview_id && Array.isArray(draft.answers) && Array.isArray(draft.questions)) {
            setPending(draft)
            setActiveView("review")
          }
        }
      } catch { /* Server history remains available when browser storage is disabled. */ }
    } catch (e) { setToastError(e instanceof Error ? e.message : "Could not connect to the backend.") }
    finally { setConnecting(false) }
  }, [refreshHistory])
  useEffect(() => { void initialize() }, [initialize])

  const handleSetupStart = async (setup: SetupInput) => {
    setToastError(null)
    setIsStarting(true)
    try {
      setPlan(await planInterview(setup))
      setResults(null)
      setActiveView("interview")
    } catch (e) { setToastError(e instanceof Error ? e.message : "Could not create the interview.") }
    finally { setIsStarting(false) }
  }
  const analyze = async (payload: AnalyzeInput) => {
    setPending(payload)
    setTranscript(payload.answers.map((a) => a.text).join(" "))
    try { sessionStorage.setItem("interviewpilot.pending.v1", JSON.stringify(payload)) } catch { /* Best-effort offline recovery. */ }
    setToastError(null)
    setActiveView("processing")
    try {
      await saveDraft(payload)
      const out = await analyzeInterview(payload)
      setResults(out)
      setActiveView("results")
      setPending(null)
      try { sessionStorage.removeItem("interviewpilot.pending.v1") } catch { /* no-op */ }
      await refreshHistory()
    } catch (e) {
      setToastError(e instanceof Error ? e.message : "Analysis failed. Your recording is available to retry.")
      setActiveView("review")
    }
  }
  const openHistory = async (id: string) => {
    try {
      const saved = await getInterview(id)
      setTranscript(saved.payload.answers.map((a) => a.text).join(" "))
      setPlan({ questions: saved.payload.questions, rubric: saved.payload.rubric })
      if (saved.result) { setResults(saved.result); setActiveView("results") }
      else { setPending(saved.payload); setActiveView("review") }
    } catch (e) { setToastError(e instanceof Error ? e.message : "Could not load the interview.") }
  }
  const removeHistory = async (id: string) => {
    try {
      await deleteInterview(id)
      if (pending?.interview_id === id) {
        setPending(null)
        try { sessionStorage.removeItem("interviewpilot.pending.v1") } catch { /* no-op */ }
      }
      await refreshHistory()
    } catch (e) { setToastError(e instanceof Error ? e.message : "Could not delete the interview.") }
  }

  return (
    <main className="min-h-screen bg-background">
      {toastError && <div role="alert" className="m-4 rounded-xl border border-destructive bg-card p-4 flex gap-4">
        <span className="flex-1">{toastError}</span>
        <button onClick={() => setToastError(null)} className="text-primary">Dismiss</button>
      </div>}
      {!ready ? (
        <form className="mx-auto max-w-md p-8 space-y-4" onSubmit={(event) => { event.preventDefault(); void initialize(accessCode) }}>
          <h1 className="text-2xl font-bold">InterviewPilot</h1>
          <p>{accessRequired ? "Enter the demo access code to start." : "Connecting to your interview workspace."}</p>
          {accessRequired && <input type="password" aria-label="Demo access code" value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)} className="w-full rounded border p-3 bg-card" />}
          <button disabled={connecting} className="rounded bg-primary px-5 py-3 text-primary-foreground">
            {connecting ? "Connecting…" : accessRequired ? "Continue" : "Retry connection"}
          </button>
        </form>
      ) : (
        <>
          {activeView !== "interview" && activeView !== "processing" && <nav className="p-4">
            <button onClick={() => { setActiveView("setup"); void refreshHistory().catch(() => {}) }} className="text-primary">
              Setup & history
            </button>
          </nav>}
          {activeView === "setup" && <>
            <SetupScreen onStart={handleSetupStart} isStarting={isStarting} onClientError={setToastError} />
            <InterviewHistory interviews={history} onOpen={(id) => void openHistory(id)} onDelete={(id) => void removeHistory(id)} />
          </>}
          {activeView === "interview" && plan && <InterviewScreen plan={plan} onEnd={analyze} onError={setToastError} />}
          {activeView === "processing" && <ProcessingScreen />}
          {activeView === "review" && pending && <section className="mx-auto max-w-3xl p-6 space-y-5">
            <h1 className="text-2xl font-semibold">Your recording is ready</h1>
            <p className="text-muted-foreground">Review the captured answers, then retry analysis. You do not need to repeat the interview.</p>
            {pending.answers.map((answer, index) => <div key={index} className="rounded-xl border p-4">
              <h2 className="font-medium">{pending.questions[index]}</h2>
              <p className="mt-2 text-muted-foreground">{answer.text || (answer.asked ? "No answer captured." : "Question not reached.")}</p>
            </div>)}
            <button onClick={() => void analyze(pending)} className="rounded-xl bg-primary px-6 py-3 text-primary-foreground">Analyze recording</button>
          </section>}
          {activeView === "results" && results && <ResultsScreen results={results} transcript={transcript}
            onRetry={() => { setResults(null); setActiveView("setup") }} />}
        </>
      )}
    </main>
  )
}
