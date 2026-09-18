import { expect, it } from "vitest"
import { isResumeFilename } from "../app/components/ResumeUpload"

it("accepts pdf and txt resume filenames", () => {
  expect(isResumeFilename("resume.pdf")).toBe(true)
  expect(isResumeFilename("CV.TXT")).toBe(true)
  expect(isResumeFilename("notes.docx")).toBe(false)
  expect(isResumeFilename("photo.png")).toBe(false)
  expect(isResumeFilename("resume")).toBe(false)
})
