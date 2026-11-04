export interface ParsedQuickAdd {
  title: string
  minutesPerSubtask: number
  totalSubtasks: number
}

export interface QuickAddParseResult {
  success: boolean
  parsed?: ParsedQuickAdd
  /** Best-effort partial recognition, used to pre-fill the manual form on parse failure (QA-2). */
  recognized: { title: string; minutesPerSubtask?: number; totalSubtasks?: number }
}

const UNIT_WORD = /^\s*(pages?|questions?|problems?|reps?|chapters?|sets?|rounds?|exercises?|items?|units?|lines?|cards?|sections?|laps?|rows?)\b/i
const CONNECTOR_WORDS = /^(at|of|to|for|the|a|an)\s+|\s+(at|of|to|for)$/gi

function stripPunctuation(text: string): string {
  return text.replace(/[,.]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function stripConnectors(text: string): string {
  let result = text
  let previous: string
  do {
    previous = result
    result = result.replace(CONNECTOR_WORDS, ' ').trim()
  } while (result !== previous)
  return stripPunctuation(result)
}

/**
 * Best-effort natural-language parse of a quick-add line into {title, minutesPerSubtask, totalSubtasks}.
 * Returns success:false (never a guessed-but-wrong result) whenever either number is ambiguous or missing,
 * so the caller always falls back to the manual form per QA-2 rather than silently mis-parsing.
 */
export function parseQuickAdd(input: string): QuickAddParseResult {
  const raw = input.trim()
  if (!raw) {
    return { success: false, recognized: { title: '' } }
  }

  // 1. Minutes per subtask: a number immediately followed by "min"/"minute(s)".
  const minutesMatch = raw.match(/(\d+(?:\.\d+)?)\s*min(?:ute)?s?\b(?:\s*(?:each|per\s*\w+))?/i)
  const minutesPerSubtask = minutesMatch ? Number(minutesMatch[1]) : undefined
  const withoutMinutes = minutesMatch ? raw.slice(0, minutesMatch.index) + raw.slice(minutesMatch.index! + minutesMatch[0].length) : raw

  // 2. Total subtasks: the first standalone number in what's left, optionally followed by a unit word to also strip.
  const totalMatch = withoutMinutes.match(/(\d+(?:\.\d+)?)/)
  let totalSubtasks: number | undefined
  let withoutTotal = withoutMinutes
  if (totalMatch) {
    totalSubtasks = Number(totalMatch[1])
    const afterNumber = withoutMinutes.slice(totalMatch.index! + totalMatch[0].length)
    const unitMatch = afterNumber.match(UNIT_WORD)
    const consumedLength = totalMatch[0].length + (unitMatch ? unitMatch[0].length : 0)
    withoutTotal = withoutMinutes.slice(0, totalMatch.index) + withoutMinutes.slice(totalMatch.index! + consumedLength)
  }

  const title = stripConnectors(withoutTotal)

  const recognized = { title: title || raw, minutesPerSubtask, totalSubtasks }

  if (!title || minutesPerSubtask === undefined || totalSubtasks === undefined || minutesPerSubtask <= 0 || totalSubtasks <= 0) {
    return { success: false, recognized }
  }

  return {
    success: true,
    parsed: { title, minutesPerSubtask, totalSubtasks: Math.floor(totalSubtasks) },
    recognized,
  }
}
