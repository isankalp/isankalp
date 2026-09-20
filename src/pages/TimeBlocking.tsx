import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/db'
import TaskRow from '../components/TaskRow'
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  GRID_TOTAL_MINUTES,
  defaultBlockDuration,
  gridMinutesToTime,
  layoutBlocks,
  overlappingBlockIds,
  snapTo15,
  timeToGridMinutes,
  type TimeBlock,
} from '../lib/timeBlocking'
import { unitLabel, type Task } from '../db/models'
import { todayKey } from '../lib/date'

const PX_PER_MINUTE = 1.5
const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i)

export default function TimeBlocking() {
  const { date } = useParams<{ date: string }>()
  const activeDate = date ?? todayKey()
  const gridRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ taskId: string; duration: number } | null>(null)

  const day = useLiveQuery(() => db.days.where('date').equals(activeDate).first(), [activeDate])
  const tasks = useLiveQuery(async () => {
    if (!day) return []
    return db.tasks.where('dayId').equals(day.id).toArray()
  }, [day])

  const loading = tasks === undefined
  const allTasks = tasks ?? []
  const scheduled = allTasks.filter((t) => t.scheduledStart)
  const unscheduled = allTasks.filter((t) => !t.scheduledStart)

  const blocks: TimeBlock[] = scheduled.map((t) => ({
    id: t.id,
    start: timeToGridMinutes(t.scheduledStart!),
    duration: resizing?.taskId === t.id ? resizing.duration : (t.scheduledDurationMinutes ?? defaultBlockDuration(t)),
  }))
  const overlapping = overlappingBlockIds(blocks)
  const blockById = new Map(blocks.map((b) => [b.id, b]))
  const layoutById = new Map(layoutBlocks(blocks).map((l) => [l.id, l]))

  async function scheduleTask(taskId: string, startGridMinutes: number) {
    const task = allTasks.find((t) => t.id === taskId)
    if (!task) return
    const duration = task.scheduledStart ? (task.scheduledDurationMinutes ?? defaultBlockDuration(task)) : defaultBlockDuration(task)
    const clampedStart = Math.min(startGridMinutes, GRID_TOTAL_MINUTES - Math.min(duration, GRID_TOTAL_MINUTES))
    try {
      await db.tasks.update(taskId, {
        scheduledStart: gridMinutesToTime(Math.max(0, clampedStart)),
        scheduledDurationMinutes: duration,
        updatedAt: Date.now(),
      })
      setError(null)
    } catch {
      // Drop reverts on its own — the live query never reflected an optimistic change, so nothing to undo.
      setError('Could not save that placement — try again.')
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (!taskId || !gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutes = snapTo15(y / PX_PER_MINUTE)
    scheduleTask(taskId, Math.max(0, minutes))
  }

  async function unschedule(taskId: string) {
    try {
      await db.tasks.update(taskId, { scheduledStart: undefined, scheduledDurationMinutes: undefined, updatedAt: Date.now() })
      setError(null)
    } catch {
      setError('Could not unschedule that task — try again.')
    }
  }

  function startResize(taskId: string, initialDuration: number, startY: number) {
    setResizing({ taskId, duration: initialDuration })
    function onMove(e: PointerEvent) {
      const deltaMinutes = (e.clientY - startY) / PX_PER_MINUTE
      const next = Math.max(15, snapTo15(initialDuration + deltaMinutes))
      setResizing({ taskId, duration: next })
    }
    function onUp(e: PointerEvent) {
      const deltaMinutes = (e.clientY - startY) / PX_PER_MINUTE
      const finalDuration = Math.max(15, snapTo15(initialDuration + deltaMinutes))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setResizing(null)
      db.tasks.update(taskId, { scheduledDurationMinutes: finalDuration, updatedAt: Date.now() }).catch(() => {
        setError('Could not save that resize — try again.')
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-3">Time-Blocking</h2>
        <div className="animate-pulse h-[600px] rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Time-Blocking — {activeDate}</h2>
        <Link to={`/day/${activeDate}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          ← List view
        </Link>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-500/10 text-[11px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr_220px] gap-3">
        <div
          ref={gridRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="relative rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
          style={{ height: `${GRID_TOTAL_MINUTES * PX_PER_MINUTE}px` }}
        >
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500 pl-1"
              style={{ top: `${(hour - GRID_START_HOUR) * 60 * PX_PER_MINUTE}px` }}
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}

          <div className="absolute left-14 right-2 top-0 bottom-0">
            {scheduled.map((task) => {
              const block = blockById.get(task.id)
              const layout = layoutById.get(task.id)
              if (!block || !layout) return null
              const isOverlapping = overlapping.has(task.id)
              const widthPercent = 100 / layout.columnCount
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                  className={`absolute rounded-md px-2 py-1 text-[11px] overflow-hidden cursor-move ${
                    isOverlapping
                      ? 'border-2 border-red-500 bg-red-50 dark:bg-red-500/20'
                      : 'border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-500/20'
                  }`}
                  style={{
                    top: `${block.start * PX_PER_MINUTE}px`,
                    height: `${Math.max(block.duration * PX_PER_MINUTE, 24)}px`,
                    left: `${layout.column * widthPercent}%`,
                    width: `calc(${widthPercent}% - 2px)`,
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate">{task.title}</span>
                    <button
                      type="button"
                      onClick={() => unschedule(task.id)}
                      aria-label={`Unschedule ${task.title}`}
                      className="shrink-0 text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {task.scheduledStart} · {block.duration} min
                    {isOverlapping ? ' · conflict' : ''}
                  </span>
                  <div
                    draggable
                    onDragStart={(e) => e.preventDefault()}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      startResize(task.id, block.duration, e.clientY)
                    }}
                    aria-label={`Resize ${task.title} block`}
                    role="slider"
                    aria-valuenow={block.duration}
                    tabIndex={-1}
                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-indigo-300/50 dark:bg-indigo-500/50"
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Unscheduled</h3>
          {unscheduled.length === 0 ? (
            <p className="text-[11px] text-slate-400">Everything is on the grid.</p>
          ) : (
            <ul className="space-y-2">
              {unscheduled.map((task) => (
                <UnscheduledItem key={task.id} task={task} dayTasks={allTasks} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function UnscheduledItem({ task, dayTasks }: { task: Task; dayTasks: Task[] }) {
  return (
    <div draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)} className="cursor-move" title={`Drag onto the grid to schedule (${unitLabel(task)})`}>
      <TaskRow task={task} dayTasks={dayTasks} />
    </div>
  )
}
