import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastKind = 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 3500

/** A small generic toast stack (success/error), used by Export Tasks (EX-6/EX-7) and the bottom
 *  Quick-Add bar (LR-6) — anywhere a background action needs transient confirmation without a modal. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, kind }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`px-4 py-2.5 rounded-full text-sm font-medium shadow-lg ${
              t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
