"use client"

import { useState, useEffect, useRef } from "react"
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
function SetupScreen({ onStart }: { onStart: () => void }) {
  const [role, setRole] = useState("software-engineer")
  const [style, setStyle] = useState("behavioral")
  const [vibe, setVibe] = useState("startup")
  const [difficulty, setDifficulty] = useState("medium")

  const roleOptions: SelectOption[] = [
    { value: "software-engineer", label: "Software Engineer" },
    { value: "product-manager", label: "Product Manager" },
    { value: "data-scientist", label: "Data Scientist" },
    { value: "designer", label: "UX Designer" },
    { value: "marketing", label: "Marketing Manager" },
  ]

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
    console.log("[v0] Starting interview with config:", { role, style, vibe, difficulty })
    console.log("[v0] TODO: API call to generate interview questions")
    onStart()
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
          <CustomSelect
            label="Role"
            icon={Briefcase}
            options={roleOptions}
            value={role}
            onChange={setRole}
          />
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
          onClick={handleStart}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          Start Interview
        </button>
      </div>
    </div>
  )
}

// Interview Screen (Live HUD)
function InterviewScreen({ onEnd }: { onEnd: () => void }) {
  const [timeLeft, setTimeLeft] = useState(30)
  const [fillerWords, setFillerWords] = useState(3)
  const [eyeContact, setEyeContact] = useState(85)
  const [speechPace, setSpeechPace] = useState(140)

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

  const handleEnd = () => {
    console.log("[v0] Ending interview")
    console.log("[v0] TODO: API call to stop recording and submit for analysis")
    onEnd()
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
                  {'"'}Tell me about a time when you had to work with a difficult team member. How
                  did you handle the situation and what was the outcome?{'"'}
                </p>
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
          onClick={handleEnd}
          className="px-8 py-3 bg-destructive text-destructive-foreground font-semibold rounded-full hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all duration-300 flex items-center gap-2"
        >
          <span className="h-2 w-2 bg-white rounded-full" />
          End Interview
        </button>
      </div>
    </div>
  )
}

// Processing Screen
function ProcessingScreen({ onComplete }: { onComplete: () => void }) {
  const handleSimulateComplete = () => {
    console.log("[v0] Analysis complete, showing results")
    console.log("[v0] TODO: This would normally wait for API response")
    onComplete()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      {/* Spinner */}
      <div className="relative">
        <div className="w-24 h-24 border-4 border-secondary rounded-full"></div>
        <div className="absolute top-0 left-0 w-24 h-24 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-8 h-8 bg-primary/30 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">ASI:One Agents Analyzing...</h2>
        <p className="text-muted-foreground">Processing your interview performance</p>
      </div>

      {/* Dev Button */}
      <button
        onClick={handleSimulateComplete}
        className="mt-8 px-6 py-2 bg-secondary border border-border text-muted-foreground rounded-lg hover:text-foreground hover:border-primary/50 transition-colors text-sm"
      >
        Simulate Complete (Dev)
      </button>
    </div>
  )
}

// Results Screen
function ResultsScreen({ onRetry }: { onRetry: () => void }) {
  const score = 78

  const strengths = [
    "Strong use of the STAR method to structure your response",
    "Excellent eye contact maintained throughout (85%)",
    "Clear and confident speaking pace",
  ]

  const improvements = [
    "Reduce filler words - try pausing instead of saying 'um'",
    "Provide more specific metrics and outcomes",
    "Consider adding a brief reflection on learnings",
  ]

  const handleRetry = () => {
    console.log("[v0] Retrying interview question")
    console.log("[v0] TODO: API call to reset session or get same/new question")
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
          <ul className="space-y-3">
            {improvements.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-muted-foreground">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Retry Button */}
      <button
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

  return (
    <main className="min-h-screen bg-background">
      {activeView === "setup" && <SetupScreen onStart={() => setActiveView("interview")} />}
      {activeView === "interview" && (
        <InterviewScreen onEnd={() => setActiveView("processing")} />
      )}
      {activeView === "processing" && (
        <ProcessingScreen onComplete={() => setActiveView("results")} />
      )}
      {activeView === "results" && <ResultsScreen onRetry={() => setActiveView("interview")} />}
    </main>
  )
}
