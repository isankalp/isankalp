import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parses a simple CSV with a header row', () => {
    const rows = parseCsv('title,minutesPerSubtask,totalSubtasks\nRead,5,10\nRun,2,3\n')
    expect(rows).toEqual([
      ['title', 'minutesPerSubtask', 'totalSubtasks'],
      ['Read', '5', '10'],
      ['Run', '2', '3'],
    ])
  })

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('title,minutesPerSubtask,totalSubtasks\n"Solve, then review",5,10\n')
    expect(rows[1]).toEqual(['Solve, then review', '5', '10'])
  })

  it('handles escaped double quotes inside a quoted field', () => {
    const rows = parseCsv('title\n"Say ""hi"" now"\n')
    expect(rows[1]).toEqual(['Say "hi" now'])
  })

  it('handles CRLF line endings', () => {
    const rows = parseCsv('title,total\r\nRead,10\r\n')
    expect(rows).toEqual([
      ['title', 'total'],
      ['Read', '10'],
    ])
  })

  it('skips trailing blank lines', () => {
    const rows = parseCsv('title\nRead\n\n')
    expect(rows).toEqual([['title'], ['Read']])
  })
})
