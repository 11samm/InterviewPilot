"use client"

import { useState, useEffect, useRef } from "react"
import {
  planInterview,
  analyzeInterview,
  type AnalyzeOutput,
  type FaceMetric,
  type PlanOutput,
  type SetupInput,
} from "@/app/lib/api"
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

  const query = value.trim().toLowerCase()
  const suggestions = ROLE_PRESETS.filter(
    (opt) => !query || opt.label.toLowerCase().includes(query),
  )

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
        {isOpen && suggestions.length > 0 ? (
          <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
            {suggestions.map((option) => (
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
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Pick Software Engineer, Product Manager, Data Scientist, or enter any job title.
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

  const styleOptions: SelectOption[] = [
    { value: "behavioral", label: "Behavioral" },
    { value: "technical", label: "Technical" },
    { value: "case-study", label: "Case Study" },
    { value: "system-design", label: "System Design" },
  ]

  const vibeOptions: SelectOption[] = [
    { value: "startup", label: "Startup" },
    { value: "big-tech", label: "Big Tech (FAANG)" },
    { value: "enterprise", label: "Enterprise" },
    { value: "agency", label: "Agency" },
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
    void onStart({ role: trimmedRole, style, vibe, difficulty })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
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
        <div className="space-y-5 bg-card border border-border rounded-xl p-6">
          <RoleCombobox value={role} onChange={setRole} />
          <CustomSelect
            label="Interview Style"
            icon={MessageSquare}
            options={styleOptions}
            value={style}
            onChange={setStyle}
          />
          <CustomSelect
            label="Company Vibe"
            icon={Building2}
            options={vibeOptions}
            value={vibe}
            onChange={setVibe}
          />
          <CustomSelect
            label="Difficulty"
            icon={Gauge}
            options={difficultyOptions}
            value={difficulty}
            onChange={setDifficulty}
          />
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
}: {
  plan: PlanOutput
  onEnd: (payload: {
    transcript: string
    duration_seconds: number
    face_metrics: FaceMetric[]
  }) => void | Promise<void>
}) {
  const [timeLeft, setTimeLeft] = useState(30)
  const [fillerWords, setFillerWords] = useState(3)
  const [eyeContact, setEyeContact] = useState(85)
  const [speechPace, setSpeechPace] = useState(140)
  const [isEnding, setIsEnding] = useState(false)
  const sessionStartRef = useRef<number>(Date.now())

  useEffect(() => {
    sessionStartRef.current = Date.now()
  }, [plan])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Simulate changing metrics
    const metricsInterval = setInterval(() => {
      setFillerWords((prev) => Math.max(0, prev + Math.floor(Math.random() * 3) - 1))
      setEyeContact((prev) => Math.min(100, Math.max(60, prev + Math.floor(Math.random() * 11) - 5)))
      setSpeechPace((prev) => Math.min(180, Math.max(100, prev + Math.floor(Math.random() * 21) - 10)))
    }, 3000)

    return () => {
      clearInterval(timer)
      clearInterval(metricsInterval)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleEnd = async () => {
    if (isEnding) return
    setIsEnding(true)
    const duration_seconds = (Date.now() - sessionStartRef.current) / 1000
    const ec = Math.min(100, Math.max(0, eyeContact)) / 100
    const face_metrics: FaceMetric[] = [
      { timestamp: 0, eye_contact: ec, head_pitch: 0, head_yaw: 0 },
      {
        timestamp: Math.max(0, duration_seconds * 0.45),
        eye_contact: Math.min(1, ec + 0.04),
        head_pitch: 0.02,
        head_yaw: -0.03,
      },
      {
        timestamp: duration_seconds,
        eye_contact: ec,
        head_pitch: -0.01,
        head_yaw: 0.02,
      },
    ]
    const transcript = [
      `Question 1: ${plan.questions[0]}`,
      plan.questions[1] ? `Question 2: ${plan.questions[1]}` : "",
      "[Simulated transcript] The candidate walked through a concrete example, described their actions, and summarized outcomes.",
    ]
      .filter(Boolean)
      .join("\n\n")

    try {
      await onEnd({ transcript, duration_seconds, face_metrics })
    } finally {
      setIsEnding(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">InterviewPilot</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-sm text-red-400 font-medium">Recording</span>
          </div>
          <div className="px-3 py-1 bg-secondary rounded-lg text-foreground font-mono text-sm">
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex p-6 gap-6">
        {/* Main Stage - Webcam Placeholder */}
        <div className="flex-1 lg:w-[70%] relative">
          <div className="w-full h-full min-h-[400px] bg-card rounded-xl border border-border relative overflow-hidden shadow-[0_0_60px_rgba(147,51,234,0.1)]">
            {/* Webcam placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Video className="h-24 w-24 text-muted-foreground/30" />
            </div>

            {/* Question Overlay */}
            <div className="absolute bottom-6 left-6 right-6">
              <div className="backdrop-blur-xl bg-card/60 border border-border/50 rounded-xl p-6 shadow-xl">
                <p className="text-lg text-foreground leading-relaxed text-balance">
                  &ldquo;{plan.questions[0]}&rdquo;
                </p>
                {plan.questions[1] ? (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    Next: &ldquo;{plan.questions[1]}&rdquo;
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Sidebar */}
        <div className="w-full lg:w-[30%] max-w-xs space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Live Metrics
          </h3>

          {/* Filler Words */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Mic className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Filler Words</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              Ums/Ahs: <span className="text-primary">{fillerWords}</span>
            </p>
          </div>

          {/* Eye Contact */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Eye className="h-4 w-4 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Eye Contact</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              <span className="text-accent">{eyeContact}%</span>
            </p>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${eyeContact}%` }}
              />
            </div>
          </div>

          {/* Speech Pace */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Speech Pace</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              <span className="text-primary">{speechPace}</span>{" "}
              <span className="text-sm font-normal text-muted-foreground">WPM</span>
            </p>
          </div>
        </div>
      </div>

      {/* Floating Control Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <button
          type="button"
          onClick={() => void handleEnd()}
          disabled={isEnding}
          className="px-8 py-3 bg-destructive text-destructive-foreground font-semibold rounded-full hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all duration-300 flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
        >
          <span className="h-2 w-2 bg-white rounded-full" />
          {isEnding ? "Submitting…" : "End Interview"}
        </button>
      </div>
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
        <InterviewScreen plan={plan} onEnd={handleInterviewEnd} />
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
