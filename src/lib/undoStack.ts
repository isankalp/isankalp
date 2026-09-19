export interface UndoEntry {
  description: string
  undo: () => Promise<void>
}

const stack: UndoEntry[] = []
const MAX_ENTRIES = 20
type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((l) => l())
}

export function pushUndo(entry: UndoEntry): void {
  stack.push(entry)
  if (stack.length > MAX_ENTRIES) stack.shift()
  notify()
}

/** Reverts exactly the immediately preceding mutating action (DR-1) — never an older one. */
export async function undoLast(): Promise<string | null> {
  const entry = stack.pop()
  if (!entry) return null
  await entry.undo()
  notify()
  return entry.description
}

export function hasUndo(): boolean {
  return stack.length > 0
}

export function peekUndo(): string | null {
  return stack.length > 0 ? stack[stack.length - 1].description : null
}

export function subscribeUndo(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Test-only: clears the stack between test cases. */
export function clearUndoStackForTests(): void {
  stack.length = 0
}
