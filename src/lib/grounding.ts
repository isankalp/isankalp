/**
 * AI-2/AI-4/JC-2/JC-4: a real (not just prompt-hoped) check that an AI-generated narrative doesn't
 * state a number absent from the underlying data it was given. Extracts every standalone number
 * from the generated text and rejects the response if any isn't in the allowed set — small numbers
 * that plausibly reference dates/weekdays are always allowed to avoid over-rejecting harmless prose
 * like "on the 12th" or "three times this week".
 */
export function extractNumbers(text: string): number[] {
  return (text.match(/\d+(\.\d+)?/g) ?? []).map(Number)
}

export function isGrounded(text: string, allowedNumbers: Iterable<number>): boolean {
  const allowed = new Set(allowedNumbers)
  for (let i = 0; i <= 31; i++) allowed.add(i) // calendar day-of-month / small counts, always safe
  return extractNumbers(text).every((n) => allowed.has(n))
}
