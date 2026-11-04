import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearUndoStackForTests, hasUndo, peekUndo, pushUndo, undoLast } from './undoStack'

beforeEach(() => {
  clearUndoStackForTests()
})

describe('undoStack', () => {
  it('has nothing to undo initially', () => {
    expect(hasUndo()).toBe(false)
    expect(peekUndo()).toBeNull()
  })

  it('undoes exactly the most recently pushed entry, not an older one', async () => {
    const undoFirst = vi.fn().mockResolvedValue(undefined)
    const undoSecond = vi.fn().mockResolvedValue(undefined)
    pushUndo({ description: 'first', undo: undoFirst })
    pushUndo({ description: 'second', undo: undoSecond })

    expect(peekUndo()).toBe('second')
    const description = await undoLast()

    expect(description).toBe('second')
    expect(undoSecond).toHaveBeenCalledTimes(1)
    expect(undoFirst).not.toHaveBeenCalled()
  })

  it('falls back to the next-most-recent entry after one undo', async () => {
    pushUndo({ description: 'first', undo: vi.fn().mockResolvedValue(undefined) })
    pushUndo({ description: 'second', undo: vi.fn().mockResolvedValue(undefined) })

    await undoLast()
    expect(peekUndo()).toBe('first')
  })

  it('returns null when there is nothing left to undo', async () => {
    expect(await undoLast()).toBeNull()
  })

  it('caps the stack size so very old entries are dropped', () => {
    for (let i = 0; i < 25; i++) {
      pushUndo({ description: `entry-${i}`, undo: vi.fn().mockResolvedValue(undefined) })
    }
    expect(peekUndo()).toBe('entry-24')
  })
})
