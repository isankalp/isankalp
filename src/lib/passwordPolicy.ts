export interface PasswordRule {
  id: string
  label: string
  test: (password: string) => boolean
}

/** SU-2/PR-4: the exact rules named in the PRD — 8+ characters, at least 1 number. */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { id: 'number', label: 'At least 1 number', test: (pw) => /\d/.test(pw) },
]

export interface PasswordRuleResult {
  id: string
  label: string
  passed: boolean
}

/** SU-2: live, per-rule pass/fail for the signup/reset checklist. */
export function passwordRuleResults(password: string): PasswordRuleResult[] {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, passed: rule.test(password) }))
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}
