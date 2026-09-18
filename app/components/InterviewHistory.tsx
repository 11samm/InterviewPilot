"use client"
import type { InterviewSummary } from "@/app/lib/api"

export function InterviewHistory({ interviews, onOpen, onDelete }: {
  interviews: InterviewSummary[]; onOpen: (id: string) => void; onDelete: (id: string) => void
}) {
  if (!interviews.length) return null
  const completed = interviews.filter((i) => i.status === "complete" && i.overall_score !== null)
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-12 space-y-4">
      <h2 className="text-xl font-semibold">Interview history</h2>
      <p className="text-sm text-muted-foreground">
        Saved for this browser session for 30 days. Clearing cookies removes access.
        Scores across different questions are not directly comparable.
      </p>
      {completed.length > 1 && <p className="text-sm">
        Recent content scores: {completed.slice(0, 5).reverse().map((i) => i.overall_score).join(" → ")}
      </p>}
      {interviews.map((item) => (
        <div key={item.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <button className="flex-1 text-left hover:text-primary" onClick={() => onOpen(item.id)}>
            <span className="block font-medium">{new Date(item.created_at * 1000).toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">
              {item.question_count} questions · {item.status === "pending" ? "Ready to retry analysis" : `Content score: ${item.overall_score ?? "Unavailable"}`}
              {item.speech?.speech_pace_wpm != null ? ` · ${item.speech.speech_pace_wpm} WPM` : ""}
            </span>
          </button>
          <button className="text-sm text-destructive hover:underline" onClick={() => onDelete(item.id)}>Delete</button>
        </div>
      ))}
    </section>
  )
}
