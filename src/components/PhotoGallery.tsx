import { useEffect, useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { photosForTask } from '../lib/photoEvidence'
import type { CompletionPhoto, Task } from '../db/models'

function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  return url
}

function Thumbnail({ photo }: { photo: CompletionPhoto }) {
  const url = useObjectUrl(photo.blob)
  if (!url) return null
  return <img src={url} alt={`Progress evidence from ${new Date(photo.createdAt).toLocaleString()}`} className="w-full h-full object-cover" />
}

function CompareModal({ a, b, onClose }: { a: CompletionPhoto; b: CompletionPhoto; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-w-2xl w-full p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold">Before / After</h4>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">
            ✕ Close
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[a, b].map((photo) => (
            <div key={photo.id}>
              <div className="aspect-square rounded-md overflow-hidden bg-slate-100 dark:bg-slate-900">
                <Thumbnail photo={photo} />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-center">{new Date(photo.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** PP-2: chronological photo evidence for a task. PP-3: pick two to compare side by side. */
export default function PhotoGallery({ task }: { task: Task }) {
  const photos = useLiveQuery(() => photosForTask(task.id), [task.id]) ?? []
  const [selected, setSelected] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)

  if (photos.length === 0) {
    return <p className="mt-2 text-[11px] text-slate-400">No photo evidence yet.</p>
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]))
  }

  const a = photos.find((p) => p.id === selected[0])
  const b = photos.find((p) => p.id === selected[1])

  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-1.5">
        {photos.map((photo) => (
          <label key={photo.id} className="relative block aspect-square rounded-md overflow-hidden bg-slate-100 dark:bg-slate-900 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(photo.id)}
              onChange={() => toggleSelect(photo.id)}
              aria-label={`Select photo from ${new Date(photo.createdAt).toLocaleString()} for comparison`}
              className="absolute top-1 left-1 z-10"
            />
            <Thumbnail photo={photo} />
          </label>
        ))}
      </div>
      {photos.length >= 2 && (
        <button
          type="button"
          onClick={() => setComparing(true)}
          disabled={selected.length !== 2}
          className="mt-2 text-[11px] px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Compare selected (2)
        </button>
      )}
      {comparing && a && b && <CompareModal a={a} b={b} onClose={() => setComparing(false)} />}
    </div>
  )
}
