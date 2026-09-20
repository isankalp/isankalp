import { passwordRuleResults } from '../lib/passwordPolicy'

/** SU-2/PR-4: live, per-rule feedback while the user types. */
export default function PasswordChecklist({ password }: { password: string }) {
  const results = passwordRuleResults(password)
  return (
    <ul className="text-[11px] space-y-0.5" aria-live="polite">
      {results.map((r) => (
        <li
          key={r.id}
          className={r.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}
        >
          <span aria-hidden="true">{r.passed ? '✓' : '○'}</span> {r.label}
        </li>
      ))}
    </ul>
  )
}
