import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assignShards,
  coverageGaps,
  fileFilter,
  fileWeights,
  main,
  parseShard,
  secondsPerFile,
  testsPerFile,
} from './e2e-shard.mjs'

/**
 * Playwright JSON report: one top-level suite per file, a nested describe,
 * and each test with the given result durations (ms).
 * @param {Record<string, number[][]>} files
 */
function report(files) {
  return {
    suites: Object.entries(files).map(([file, tests]) => ({
      file,
      specs: tests.slice(0, 1).map((durations) => ({
        tests: [{ results: durations.map((duration) => ({ duration })) }],
      })),
      suites: [
        {
          specs: tests.slice(1).map((durations) => ({
            tests: [{ results: durations.map((duration) => ({ duration })) }],
          })),
        },
      ],
    })),
  }
}

describe('testsPerFile', () => {
  it('counts the tests of each file, nested describes included', () => {
    const counts = testsPerFile(
      report({ 'a.spec.ts': [[1], [2], [3]], 'dir/b.spec.ts': [[1]] }),
    )

    expect([...counts]).toEqual([
      ['a.spec.ts', 3],
      ['dir/b.spec.ts', 1],
    ])
  })

  it('treats a report without suites as empty', () => {
    expect(testsPerFile({ suites: [] }).size).toBe(0)
  })
})

describe('secondsPerFile', () => {
  it('sums every attempt per file in tenths of a second, files sorted', () => {
    const seconds = secondsPerFile(
      report({ 'z.spec.ts': [[1000]], 'a.spec.ts': [[1234, 2000], [550]] }),
    )

    expect(seconds).toEqual({ 'a.spec.ts': 3.8, 'z.spec.ts': 1 })
    expect(Object.keys(seconds)).toEqual(['a.spec.ts', 'z.spec.ts'])
  })
})

describe('fileWeights', () => {
  it('uses recorded seconds, else tests × the recorded mean per test', () => {
    const counts = new Map([
      ['known.spec.ts', 2],
      ['slow.spec.ts', 2],
      ['new.spec.ts', 3],
    ])

    const weights = fileWeights(counts, {
      'known.spec.ts': 10,
      'slow.spec.ts': 30,
      'gone.spec.ts': 500,
    })

    expect([...weights]).toEqual([
      ['known.spec.ts', 10],
      ['slow.spec.ts', 30],
      ['new.spec.ts', 30],
    ])
  })

  it('weighs each test 1 s when nothing listed has a record', () => {
    const weights = fileWeights(new Map([['new.spec.ts', 4]]), {})

    expect(weights.get('new.spec.ts')).toBe(4)
  })
})

describe('assignShards', () => {
  it('puts the longest files first on the least-loaded shard', () => {
    const weights = new Map([
      ['a.spec.ts', 1],
      ['b.spec.ts', 8],
      ['c.spec.ts', 5],
      ['d.spec.ts', 4],
      ['e.spec.ts', 2],
    ])

    // b 8 → 0; c 5 → 1; d 4 → 1 (9); e 2 → 0 (10); a 1 → 1 (10).
    expect(assignShards(weights, 2)).toEqual([
      ['b.spec.ts', 'e.spec.ts'],
      ['a.spec.ts', 'c.spec.ts', 'd.spec.ts'],
    ])
  })

  it('breaks weight ties by name and shard ties by index, whatever the input order', () => {
    const forward = new Map([
      ['a.spec.ts', 3],
      ['b.spec.ts', 3],
      ['c.spec.ts', 3],
    ])
    const backward = new Map([...forward].reverse())

    expect(assignShards(forward, 2)).toEqual([
      ['a.spec.ts', 'c.spec.ts'],
      ['b.spec.ts'],
    ])
    expect(assignShards(backward, 2)).toEqual(assignShards(forward, 2))
  })

  it('places every file exactly once', () => {
    const weights = new Map(
      Array.from({ length: 23 }, (_, i) => [`f${String(i)}.spec.ts`, i % 7]),
    )

    const shards = assignShards(weights, 5)

    expect(shards.flat().sort()).toEqual([...weights.keys()].sort())
  })

  it('refuses more shards than files', () => {
    expect(() => assignShards(new Map([['a.spec.ts', 1]]), 2)).toThrow(
      '1 spec files for 2 shards',
    )
  })
})

describe('fileFilter', () => {
  it('anchors the path under e2e/ and escapes regex characters', () => {
    const filter = new RegExp(fileFilter('dir/a.b(1).spec.ts'))

    expect(fileFilter('a.spec.ts')).toBe('/e2e/a\\.spec\\.ts$')
    expect(filter.test('/repo/e2e/dir/a.b(1).spec.ts')).toBe(true)
    expect(filter.test('/repo/e2e/dir/aXb(1).spec.ts')).toBe(false)
    expect(filter.test('/repo/e2e/xdir/a.b(1).spec.ts')).toBe(false)
    expect(filter.test('/repo/e2e/dir/a.b(1).spec.ts.bak')).toBe(false)
  })
})

describe('parseShard', () => {
  it('reads <i>/<n>', () => {
    expect(parseShard('3/10')).toEqual({ index: 3, total: 10 })
  })

  it.each(['0/2', '3/2', '1', 'a/b', '1/2/3'])('rejects %s', (value) => {
    expect(() => parseShard(value)).toThrow('--shard must be <i>/<n>')
  })
})

describe('coverageGaps', () => {
  it('lists missing files, count mismatches and unlisted files', () => {
    const listed = new Map([
      ['a.spec.ts', 2],
      ['b.spec.ts', 1],
      ['c.spec.ts', 3],
    ])
    const reported = new Map([
      ['a.spec.ts', 2],
      ['c.spec.ts', 1],
      ['x.spec.ts', 4],
    ])

    expect(coverageGaps(listed, reported)).toEqual([
      'b.spec.ts: listed 1, reported 0',
      'c.spec.ts: listed 3, reported 1',
      'x.spec.ts: listed 0, reported 4',
    ])
  })
})

describe('main', () => {
  /** @type {string} */
  let dir = ''
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  /** @param {Record<string, unknown>} files */
  function setup(files) {
    dir = mkdtempSync(join(tmpdir(), 'e2e-shard-'))
    for (const [name, value] of Object.entries(files)) {
      writeFileSync(join(dir, name), JSON.stringify(value))
    }
    /** @type {string[]} */
    const lines = []
    return {
      lines,
      io: {
        out: (/** @type {string} */ line) => lines.push(line),
        durationsPath: join(dir, 'durations.json'),
      },
    }
  }

  const listing = report({
    'a.spec.ts': [[0]],
    'b.spec.ts': [[0], [0]],
    'c.spec.ts': [[0]],
  })

  it('pick prints the filters of one shard', () => {
    const { lines, io } = setup({
      'list.json': listing,
      'durations.json': { 'a.spec.ts': 9, 'b.spec.ts': 4, 'c.spec.ts': 4 },
    })

    const first = main(
      ['pick', '--list', join(dir, 'list.json'), '--shard', '1/2'],
      io,
    )
    const firstLines = lines.splice(0)
    const second = main(
      ['pick', '--shard', '2/2', '--list', join(dir, 'list.json')],
      io,
    )

    expect([first, second]).toEqual([0, 0])
    expect(firstLines).toEqual([fileFilter('a.spec.ts')])
    expect(lines).toEqual([fileFilter('b.spec.ts'), fileFilter('c.spec.ts')])
  })

  it('pick reads the committed durations file by default', () => {
    const { lines, io } = setup({
      'list.json': report({
        'zz-unrecorded-a.spec.ts': [[0], [0]],
        'zz-unrecorded-b.spec.ts': [[0]],
      }),
    })

    const code = main(
      ['pick', '--list', join(dir, 'list.json'), '--shard', '2/2'],
      { out: io.out },
    )

    expect(code).toBe(0)
    expect(lines).toEqual([fileFilter('zz-unrecorded-b.spec.ts')])
  })

  it('verify passes when the report has every listed test', () => {
    const { lines, io } = setup({
      'list.json': listing,
      'report.json': listing,
    })

    const code = main(
      [
        'verify',
        '--list',
        join(dir, 'list.json'),
        '--report',
        join(dir, 'report.json'),
      ],
      io,
    )

    expect(code).toBe(0)
    expect(lines).toEqual(['e2e shards cover all 3 listed files'])
  })

  it('verify fails and names the file a shard dropped', () => {
    const { lines, io } = setup({
      'list.json': listing,
      'report.json': report({ 'a.spec.ts': [[0]], 'b.spec.ts': [[0], [0]] }),
    })

    const code = main(
      [
        'verify',
        '--list',
        join(dir, 'list.json'),
        '--report',
        join(dir, 'report.json'),
      ],
      io,
    )

    expect(code).toBe(1)
    expect(lines).toEqual([
      'c.spec.ts: listed 1, reported 0',
      'e2e shards: 1 file(s) differ from the listing',
    ])
  })

  it('record writes the durations file from a report', () => {
    const { lines, io } = setup({
      'report.json': report({ 'b.spec.ts': [[1500]], 'a.spec.ts': [[200]] }),
    })

    const code = main(['record', '--report', join(dir, 'report.json')], io)

    expect(code).toBe(0)
    expect(lines).toEqual(['wrote 2 files'])
    expect(readFileSync(io.durationsPath, 'utf8')).toBe(
      '{\n  "a.spec.ts": 0.2,\n  "b.spec.ts": 1.5\n}\n',
    )
  })

  it('rejects a missing option value and an unknown command', () => {
    const { io } = setup({})

    expect(() => main(['pick', '--shard'], io)).toThrow(
      'missing --shard <value>',
    )
    expect(() => main(['verify'], io)).toThrow('missing --list <value>')
    expect(() => main(['split'], io)).toThrow(
      'usage: e2e-shard.mjs pick|verify|record (got split)',
    )
  })
})
