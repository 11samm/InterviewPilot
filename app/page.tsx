"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  planInterview,
  analyzeInterview,
  type AnalyzeOutput,
  type FaceMetric,
  type PlanOutput,
  type SetupInput,
} from "@/app/lib/api"
import { useLiveAPI } from "@/app/hooks/useLiveAPI"
import {
  Briefcase,
  MessageSquare,
  Building2,
  Gauge,
  ChevronDown,
  Video,
  Mic,
  Eye,
  Activity,
  Check,
  AlertTriangle,
  RotateCcw,
  Plane,
} from "lucide-react"

type ActiveView = "setup" | "interview" | "processing" | "results"

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
function InterviewScreen({
  plan,
  onEnd,
  onError,
}: {
  plan: PlanOutput
  onEnd: (payload: {
    transcript: string
    duration_seconds: number
    face_metrics: FaceMetric[]
  }) => void | Promise<void>
  onError: (message: string) => void
}) {
  // ─── State ────────────────────────────────────────────────────────────────────
  const [hasStarted, setHasStarted] = useState(false)       // user clicked "Start"
  const [isSubmitting, setIsSubmitting] = useState(false)   // waiting for onEnd
  const [elapsedSeconds, setElapsedSeconds] = useState(0)   // elapsed timer
  const [userSpeakingSeconds, setUserSpeakingSeconds] = useState(0)  // only ticks when user speaks (not AI)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const sessionStartRef = useRef<number>(0)
  const isEndingRef = useRef(false) // guard against double-submit

  // ─── Live API ─────────────────────────────────────────────────────────────────
  const {
    startSession,
    stopSession,
    isConnected,
    isGeminiSpeaking,
    userTranscript,
    getUserTranscript,
    geminiTranscript,
  } = useLiveAPI({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "",
    questions: plan.questions,
    rubric: plan.rubric,
    onInterviewComplete: () => {
      void submitHandoff()
    },
    onError,
  })

  // ─── Computed metrics from live transcript ───────────────────────────────────
  const FILLER_SET = new Set([
    "um", "uh", "like", "basically", "literally", "sort", "right", "okay", "yeah",
  ])

  const fillerCount = userTranscript
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => FILLER_SET.has(w.replace(/[^a-z]/g, ""))).length

  const speechPaceWpm = (() => {
    if (userSpeakingSeconds < 5) return 0
    const words = userTranscript.trim().split(/\s+/).filter(Boolean).length
    return Math.round((words / userSpeakingSeconds) * 60)
  })()

  // ─── Handoff: collect data and call onEnd ────────────────────────────────────
  // Called by Gemini's end_interview tool and the floating Complete / End Early actions.
  // isEndingRef prevents double-submission if both fire simultaneously.
  const submitHandoff = useCallback(async () => {
    if (isEndingRef.current) return
    isEndingRef.current = true
    setIsSubmitting(true)

    const transcript = getUserTranscript()
    const duration_seconds = sessionStartRef.current
      ? (Date.now() - sessionStartRef.current) / 1000
      : 0
    // Sprint 5: replace with real faceMetrics from useFaceTracker
    const face_metrics: FaceMetric[] = []

    try {
      await onEnd({ transcript, duration_seconds, face_metrics })
    } catch {
      // onEnd / parent handles errors; isSubmitting stays true if we navigated away
      setIsSubmitting(false)
    }
  }, [getUserTranscript, onEnd])

  // ─── Side effects ─────────────────────────────────────────────────────────────

  // Start elapsed timer once Live API is connected
  useEffect(() => {
    if (!isConnected) return
    if (sessionStartRef.current === 0) {
      sessionStartRef.current = Date.now()
    }
    const interval = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - sessionStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isConnected])

  // User-speaking timer: only ticks when user is speaking (not when Gemini is)
  useEffect(() => {
    if (!hasStarted || !isConnected || isGeminiSpeaking) return
    const interval = setInterval(() => {
      setUserSpeakingSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [hasStarted, isConnected, isGeminiSpeaking])

  // Advance to Q2 when Gemini says it in the transcript
  useEffect(() => {
    if (currentQuestionIndex >= 1 || !plan.questions[1]) return
    const needle = plan.questions[1].slice(0, 30).toLowerCase()
    if (geminiTranscript.toLowerCase().includes(needle)) {
      setCurrentQuestionIndex(1)
    }
  }, [geminiTranscript, currentQuestionIndex, plan.questions])

  // ─── Handlers ────────────────────────────────────────────────────────────────

  // Called from "Start Live Session" button — must remain a synchronous click handler
  // so AudioContext creation inside startSession() happens within the user gesture.
  const handleStartSession = () => {
    setHasStarted(true)
    isEndingRef.current = false
    sessionStartRef.current = 0
    setElapsedSeconds(0)
    setUserSpeakingSeconds(0)
    setCurrentQuestionIndex(0)
    void startSession()
  }

  // Emergency exit — user terminates before Gemini fires end_interview
  const handleEndEarly = () => {
    stopSession()     // closes WebSocket; does NOT call onInterviewComplete
    void submitHandoff() // manually trigger the handoff
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  }

  // Status badge config
  type BadgeConfig = { label: string; dotClass: string; textClass: string }
  const badge: BadgeConfig | null = !hasStarted
    ? null
    : !isConnected
    ? { label: "Connecting…", dotClass: "bg-yellow-400", textClass: "text-yellow-400" }
    : isGeminiSpeaking
    ? { label: "AI Speaking", dotClass: "bg-blue-400", textClass: "text-blue-400" }
    : { label: "Your Turn", dotClass: "bg-green-400", textClass: "text-green-400" }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">InterviewPilot</span>
        </div>
        <div className="flex items-center gap-3">
          {badge ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badge.dotClass}`}
                />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${badge.dotClass}`} />
              </span>
              <span className={`text-sm font-medium ${badge.textClass}`}>{badge.label}</span>
            </div>
          ) : null}
          <div className="px-3 py-1 bg-secondary rounded-lg text-foreground font-mono text-sm">
            {formatTime(elapsedSeconds)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex p-6 gap-6">
        {/* Main Stage */}
        <div className="flex-1 lg:w-[70%] relative">
          <div className="w-full h-full min-h-[400px] bg-card rounded-xl border border-border relative overflow-hidden shadow-[0_0_60px_rgba(147,51,234,0.1)]">
            {/* Webcam placeholder — Sprint 5 replaces with real <video> */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Video className="h-24 w-24 text-muted-foreground/30" />
            </div>

            {/* Gemini speaking pulse overlay */}
            {isGeminiSpeaking && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative h-2 w-2 rounded-full bg-blue-400" />
                </span>
                <span className="text-xs text-blue-400 font-medium">AI Speaking</span>
              </div>
            )}

            {/* Question Overlay */}
            <div className="absolute bottom-6 left-6 right-6 space-y-3">
              <div className="backdrop-blur-xl bg-card/60 border border-border/50 rounded-xl p-6 shadow-xl">
                <p className="text-lg text-foreground leading-relaxed text-balance">
                  &ldquo;{plan.questions[currentQuestionIndex]}&rdquo;
                </p>
                {plan.questions[currentQuestionIndex + 1] ? (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    Next: &ldquo;{plan.questions[currentQuestionIndex + 1]}&rdquo;
                  </p>
                ) : null}
              </div>

              {/* Live transcript — only shown once connected and user has spoken */}
              {isConnected && userTranscript ? (
                <div className="backdrop-blur-sm bg-secondary/70 border border-border/30 rounded-lg px-4 py-2 max-h-16 overflow-y-auto">
                  <p className="text-xs text-muted-foreground leading-relaxed">{userTranscript}</p>
                </div>
              ) : null}
            </div>

            {/* Pre-start overlay — blocks HUD until user clicks to grant mic */}
            {!hasStarted ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-md z-10 gap-4">
                <p className="text-muted-foreground text-sm">
                  Your microphone will be activated when you click start.
                </p>
                <button
                  type="button"
                  onClick={handleStartSession}
                  className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <Mic className="h-5 w-5" />
                  Start Live Session
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Metrics Sidebar */}
        <div className="w-full lg:w-[30%] max-w-xs space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Live Metrics
          </h3>

          {/* Filler Words — real count from transcript */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Mic className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Filler Words</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              Ums/Ahs:{" "}
              <span className={fillerCount > 5 ? "text-destructive" : "text-primary"}>
                {fillerCount}
              </span>
            </p>
          </div>

          {/* Eye Contact — placeholder until Sprint 5 MediaPipe */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Eye className="h-4 w-4 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Eye Contact</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              <span className="text-accent">—</span>
            </p>
            <p className="text-xs text-muted-foreground">Enabled in Sprint 5</p>
          </div>

          {/* Speech Pace — derived from transcript / user speaking time; waits for 5s first */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Speech Pace</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {speechPaceWpm > 0 ? (
                <>
                  <span className="text-primary">{speechPaceWpm}</span>
                  <span className="text-sm font-normal text-muted-foreground"> WPM</span>
                </>
              ) : hasStarted && isConnected ? (
                <span className="text-sm font-normal text-muted-foreground">
                  Measuring… {userSpeakingSeconds}/5 sec
                </span>
              ) : (
                <span className="text-primary">—</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {hasStarted && isConnected && !isSubmitting ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
          <button
            type="button"
            onClick={() => {
              stopSession()
              void submitHandoff()
            }}
            className="px-6 py-3 bg-secondary border border-border text-foreground font-medium rounded-full hover:border-primary/50 transition-all"
          >
            Complete Interview
          </button>
          <button
            type="button"
            onClick={handleEndEarly}
            className="px-8 py-3 bg-destructive text-destructive-foreground font-semibold rounded-full hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2"
          >
            <span className="h-2 w-2 bg-white rounded-full" />
            End Early
          </button>
        </div>
      ) : null}

      {isSubmitting ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
          <div className="px-8 py-3 bg-secondary text-muted-foreground font-semibold rounded-full flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Submitting…
          </div>
        </div>
      ) : null}
    </div>
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
  onRetry,
}: {
  results: AnalyzeOutput
  onRetry: () => void
}) {
  const { coaching } = results
  const score = coaching.confidence_score
  const strengths = coaching.strengths
  const improvements = coaching.improvements

  const handleRetry = () => {
    onRetry()
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6 py-12">
      {/* Score */}
      <div className="text-center mb-12">
        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
          Confidence Score
        </p>
        <div className="relative">
          <span className="text-8xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {score}
          </span>
          <span className="text-3xl text-muted-foreground">/100</span>
        </div>
        {coaching.summary ? (
          <p className="mt-6 max-w-xl mx-auto text-muted-foreground leading-relaxed text-balance">
            {coaching.summary}
          </p>
        ) : null}
      </div>

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
                  className="self-start ml-8 text-xs font-medium text-primary hover:underline"
                  disabled
                  title="Deep Dive wiring comes in a later sprint"
                >
                  Deep Dive (soon)
                </button>
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
        Retry Question
      </button>
    </div>
  )
}

// Main App Component
export default function InterviewPilot() {
  const [activeView, setActiveView] = useState<ActiveView>("setup")
  const [plan, setPlan] = useState<PlanOutput | null>(null)
  const [results, setResults] = useState<AnalyzeOutput | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [toastError, setToastError] = useState<string | null>(null)

  const handleSetupStart = async (setup: SetupInput) => {
    setToastError(null)
    setIsStarting(true)
    try {
      const nextPlan = await planInterview(setup)
      setPlan(nextPlan)
      setResults(null)
      setActiveView("interview")
    } catch (e) {
      setToastError(e instanceof Error ? e.message : "Could not start interview")
    } finally {
      setIsStarting(false)
    }
  }

  const handleInterviewEnd = async (payload: {
    transcript: string
    duration_seconds: number
    face_metrics: FaceMetric[]
  }) => {
    if (!plan) {
      setToastError("No interview plan loaded.")
      return
    }
    setToastError(null)
    setActiveView("processing")
    try {
      const out = await analyzeInterview({
        questions: plan.questions,
        rubric: plan.rubric,
        transcript: payload.transcript,
        duration_seconds: payload.duration_seconds,
        face_metrics: payload.face_metrics,
      })
      setResults(out)
      setActiveView("results")
    } catch (e) {
      setToastError(e instanceof Error ? e.message : "Analysis failed")
      setActiveView("interview")
    }
  }

  return (
    <main className="min-h-screen bg-background relative">
      {toastError ? (
        <div
          className="fixed top-4 left-1/2 z-[100] flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/15 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur-sm"
          role="alert"
        >
          <span className="flex-1">{toastError}</span>
          <button
            type="button"
            onClick={() => setToastError(null)}
            className="shrink-0 text-primary hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {activeView === "setup" && (
        <SetupScreen
          onStart={handleSetupStart}
          isStarting={isStarting}
          onClientError={(message) => setToastError(message)}
        />
      )}
      {activeView === "interview" && plan && (
        <InterviewScreen
          plan={plan}
          onEnd={handleInterviewEnd}
          onError={(msg) => setToastError(msg)}
        />
      )}
      {activeView === "processing" && <ProcessingScreen />}
      {activeView === "results" && results && (
        <ResultsScreen
          results={results}
          onRetry={() => {
            setResults(null)
            setActiveView("interview")
          }}
        />
      )}
    </main>
  )
}
