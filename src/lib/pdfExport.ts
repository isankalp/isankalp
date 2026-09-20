import { jsPDF } from 'jspdf'
import type { ReviewPeriodType } from '../db/models'
import { formatPeriodLabel } from './review'

export interface WeeklyReportData {
  type: ReviewPeriodType
  periodKey: string
  minutesPlanned: number
  minutesDone: number
  tasksCompleted: number
  streak: number
  longestStreak: number
  reflection: string
}

/** IE-4: a PDF containing the period's stats and reflection note. */
export function exportReviewPdf(data: WeeklyReportData): void {
  const doc = new jsPDF()
  const title = `${data.type === 'week' ? 'Weekly' : 'Monthly'} Review — ${formatPeriodLabel(data.type, data.periodKey)}`

  doc.setFontSize(16)
  doc.text(title, 14, 18)

  doc.setFontSize(11)
  const percent = data.minutesPlanned > 0 ? Math.round((data.minutesDone / data.minutesPlanned) * 100) : 0
  const lines = [
    `Minutes done / planned: ${data.minutesDone} / ${data.minutesPlanned} (${percent}%)`,
    `Tasks completed: ${data.tasksCompleted}`,
    `Current streak: ${data.streak} days (best: ${data.longestStreak})`,
  ]
  let y = 32
  for (const line of lines) {
    doc.text(line, 14, y)
    y += 8
  }

  y += 4
  doc.setFontSize(12)
  doc.text('Reflection', 14, y)
  y += 8
  doc.setFontSize(11)
  const reflection = data.reflection.trim() || '(no reflection written yet)'
  const wrapped = doc.splitTextToSize(reflection, 180)
  doc.text(wrapped, 14, y)

  doc.save(`review-${data.periodKey}.pdf`)
}
