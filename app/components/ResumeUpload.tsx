"use client"

import { useRef, useState } from "react"
import { FileUp, X } from "lucide-react"
import { uploadResume } from "@/app/lib/api"

export function isResumeFilename(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith(".pdf") || lower.endsWith(".txt")
}

export function ResumeUpload({
  resumeText,
  filename,
  isParsing,
  onParsed,
  onClear,
  onError,
  onParsingChange,
}: {
  resumeText: string
  filename: string | null
  isParsing: boolean
  onParsed: (text: string, filename: string | null) => void
  onClear: () => void
  onError: (message: string) => void
  onParsingChange: (parsing: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!isResumeFilename(file.name)) {
      onError("Upload a PDF or a .txt file, or paste the resume text.")
      return
    }
    onParsingChange(true)
    try {
      const result = await uploadResume(file)
      onParsed(result.text, result.filename)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not read that resume. Please retry.")
    } finally {
      onParsingChange(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <label className="text-sm text-muted-foreground flex items-center gap-2">
        <FileUp className="h-4 w-4" />
        Resume (optional)
      </label>
      <p className="text-xs text-muted-foreground">
        Upload a PDF or .txt file, or paste text. Questions will grill you on what&apos;s actually on it.
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFile(e.dataTransfer.files?.[0])
        }}
        className={`rounded-lg border border-dashed p-4 transition-colors ${
          dragOver ? "border-primary ring-2 ring-primary/50 bg-primary/5" : "border-border bg-secondary"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={isParsing}
          onClick={() => inputRef.current?.click()}
          className="text-sm text-primary hover:underline disabled:opacity-60"
        >
          {isParsing ? "Reading resume…" : "Choose PDF or .txt file"}
        </button>
        <span className="text-xs text-muted-foreground ml-2">or drag and drop</span>
      </div>
      <textarea
        value={resumeText}
        onChange={(e) => onParsed(e.target.value, null)}
        placeholder="Or paste your resume text here…"
        rows={6}
        className="w-full min-h-[8rem] bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-y"
      />
      {resumeText.trim() ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-foreground">
              {filename ?? "Pasted resume"} · {resumeText.length} characters
            </p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {resumeText.slice(0, 400)}{resumeText.length > 400 ? "…" : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Clear resume"
            onClick={onClear}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
