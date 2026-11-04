import { useEffect, useState } from 'react'
import { hasUndo, peekUndo, subscribeUndo, undoLast } from '../lib/undoStack'

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/** DR-1: a global Undo affordance (button + Ctrl/Cmd+Z) that reverts exactly the last tracked mutation. */
export default function UndoBanner() {
  const [, forceUpdate] = useState(0)
  const [lastUndone, setLastUndone] = useState<string | null>(null)

  useEffect(() => subscribeUndo(() => forceUpdate((n) => n + 1)), [])

  async function handleUndo() {
    const description = await undoLast()
    if (description) {
      setLastUndone(description)
      setTimeout(() => setLastUndone(null), 3000)
    }
  }

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const isUndoCombo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
      if (!isUndoCombo || isEditableTarget(e.target)) return
      e.preventDefault()
      handleUndo()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  if (!hasUndo() && !lastUndone) return null

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg text-xs">
      {lastUndone ? (
        <span className="text-emerald-600 dark:text-emerald-400">Undone: {lastUndone}</span>
      ) : (
        <>
          <span className="text-slate-500 dark:text-slate-400">{peekUndo()}</span>
          <button type="button" onClick={handleUndo} className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-medium">
            Undo (Ctrl+Z)
          </button>
        </>
      )}
    </div>
  )
}
