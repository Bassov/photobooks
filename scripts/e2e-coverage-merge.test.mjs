import { describe, expect, it } from 'vitest'
import {
  mergeCoverage,
  readPageCoverage,
} from '../e2e/fixtures/coverageMerge.ts'

const fullRecord = (file, hits) => ({
  path: file,
  statementMap: { 0: { start: { line: 1, column: 0 } } },
  fnMap: { 0: { name: 'f' } },
  branchMap: { 0: { type: 'if' } },
  s: { 0: hits },
  f: { 0: hits },
  b: { 0: [hits, 0] },
})

describe('mergeCoverage', () => {
  it('stores a full record the first time a file is seen', () => {
    // Arrange
    const map = {}
    const payload = { '/a.ts': fullRecord('/a.ts', 2) }

    // Act
    mergeCoverage(map, payload)

    // Assert
    expect(map).toEqual(payload)
    expect(map['/a.ts']).not.toBe(payload['/a.ts'])
  })

  it('sums statement, function and branch hits per file', () => {
    // Arrange
    const map = {}
    mergeCoverage(map, { '/a.ts': fullRecord('/a.ts', 2) })

    // Act
    mergeCoverage(map, {
      '/a.ts': { s: { 0: 3 }, f: { 0: 1 }, b: { 0: [0, 4] } },
    })

    // Assert
    expect(map['/a.ts']).toMatchObject({
      s: { 0: 5 },
      f: { 0: 3 },
      b: { 0: [2, 4] },
      statementMap: fullRecord('/a.ts', 0).statementMap,
    })
  })

  it('sums logical-branch truthy hits when present', () => {
    // Arrange
    const map = {}
    mergeCoverage(map, {
      '/a.ts': { ...fullRecord('/a.ts', 1), bT: { 0: [1, 0] } },
    })

    // Act
    mergeCoverage(map, {
      '/a.ts': { s: {}, f: {}, b: {}, bT: { 0: [1, 1] } },
    })

    // Assert
    expect(map['/a.ts'].bT).toEqual({ 0: [2, 1] })
  })

  it('adds a counter id missing from the stored record', () => {
    // Arrange
    const map = {}
    mergeCoverage(map, { '/a.ts': fullRecord('/a.ts', 1) })

    // Act
    mergeCoverage(map, {
      '/a.ts': { s: { 1: 7 }, f: {}, b: { 1: [0, 2] }, bT: { 0: [3] } },
    })

    // Assert
    expect(map['/a.ts']).toMatchObject({
      s: { 0: 1, 1: 7 },
      b: { 0: [1, 0], 1: [0, 2] },
      bT: { 0: [3] },
    })
  })

  it('throws on counters for a file the worker has not seen', () => {
    // Arrange
    const map = {}

    // Act
    const merge = () => {
      mergeCoverage(map, { '/b.ts': { s: { 0: 1 }, f: {}, b: {} } })
    }

    // Assert
    expect(merge).toThrow('coverage counters for unknown file /b.ts')
  })
})

describe('readPageCoverage', () => {
  it('returns null without an instrumented build', () => {
    // Arrange
    delete window.__coverage__

    // Act
    const json = readPageCoverage([])

    // Assert
    expect(json).toBeNull()
  })

  it('sends full records for new files and counters for known ones', () => {
    // Arrange
    window.__coverage__ = {
      '/a.ts': fullRecord('/a.ts', 1),
      '/b.ts': fullRecord('/b.ts', 2),
    }

    // Act
    const payload = JSON.parse(readPageCoverage(['/a.ts']))

    // Assert
    expect(payload).toEqual({
      '/a.ts': { s: { 0: 1 }, f: { 0: 1 }, b: { 0: [1, 0] } },
      '/b.ts': fullRecord('/b.ts', 2),
    })
    delete window.__coverage__
  })
})
