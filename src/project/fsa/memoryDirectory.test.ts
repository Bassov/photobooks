import { describe, expect, it } from 'vitest'

import { createMemoryDirectory, readMemoryFileText } from './memoryDirectory'

describe('createMemoryDirectory', () => {
  it('round-trips a string through writeText and getText', async () => {
    const root = createMemoryDirectory()
    const file = await root.getFile('note.txt', { create: true })
    const before = await file.getLastModifiedMs()
    await file.writeText('hello')
    const after = await file.getLastModifiedMs()

    const text = await readMemoryFileText(root, ['note.txt'])
    expect(text).toBe('hello')
    expect(after).toBeGreaterThanOrEqual(before)
  })
})
