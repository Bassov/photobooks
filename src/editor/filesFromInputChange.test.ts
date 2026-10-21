import { describe, expect, it } from 'vitest'
import { filesFromInputChange } from './filesFromInputChange'

function mockInput(files: File[] | null): HTMLInputElement {
  const input = document.createElement('input')
  if (files === null) {
    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => null,
    })
    return input
  }
  const list = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    *[Symbol.iterator]() {
      yield* files
    },
  } as FileList
  Object.defineProperty(input, 'files', {
    configurable: true,
    get: () => list,
  })
  return input
}

describe('filesFromInputChange', () => {
  it('returns null for a missing or empty FileList', () => {
    expect(filesFromInputChange(mockInput(null))).toBeNull()
    expect(filesFromInputChange(mockInput([]))).toBeNull()
  })

  it('copies files and clears the input value', () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const input = mockInput([file])
    const copied = filesFromInputChange(input)
    expect(copied).toEqual([file])
    expect(input.value).toBe('')
  })
})
