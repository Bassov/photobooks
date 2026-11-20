import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SPLIT_BY_LOCATION,
  assignShards,
  coverageGaps,
  main,
  parseShard,
  secondsPerLocation,
  testsPerFile,
  testsPerLocation,
  unitFilter,
  unitWeights,
} from './e2e-shard.mjs'

/**
 * Playwright JSON report: one top-level suite per file with its first spec
 * at line 1 and the rest in a nested describe at lines 2, 3, …; each spec
 * lists tests as arrays of result durations (ms).
 * @param {Record<string, number[][][]>} files
 */
function report(files) {
  /** @param {number[][]} tests @param {number} line */
  const spec = (tests, line) => ({
    line,
    tests: tests.map((durations) => ({
      results: durations.map((duration) => ({ duration })),
    })),
  })
  return {
    suites: Object.entries(files).map(([file, specs]) => ({
      file,
      specs: specs.slice(0, 1).map((tests) => spec(tests, 1)),
      suites: [{ specs: specs.slice(1).map((tests, i) => spec(tests, i + 2)) }],
    })),
  }
}

/** One spec with one 0 ms test per entry. */
const one = [[[0]]]

describe('testsPerLocation / testsPerFile', () => {
  const listing = report({
    'a.spec.ts': [[[1], [2]], [[3]]],
    'dir/b.spec.ts': [[[1]]],
  })

  it('counts the tests of each spec location, nested describes included', () => {
    expect([...testsPerLocation(listing)]).toEqual([
      ['a.spec.ts:1', 2],
      ['a.spec.ts:2', 1],
      ['dir/b.spec.ts:1', 1],
    ])
  })

  it('sums the locations per file', () => {
    expect([...testsPerFile(listing)]).toEqual([
      ['a.spec.ts', 3],
      ['dir/b.spec.ts', 1],
    ])
  })

  it('treats a report without suites as empty', () => {
    expect(testsPerFile({ suites: [] }).size).toBe(0)
  })
})

describe('secondsPerLocation', () => {
  it('sums every attempt per location in tenths of a second, sorted', () => {
    const seconds = secondsPerLocation(
      report({ 'z.spec.ts': [[[1000]]], 'a.spec.ts': [[[1234, 2000], [550]]] }),
    )

    expect(seconds).toEqual({ 'a.spec.ts:1': 3.8, 'z.spec.ts:1': 1 })
    expect(Object.keys(seconds)).toEqual(['a.spec.ts:1', 'z.spec.ts:1'])
  })
})

describe('SPLIT_BY_LOCATION', () => {
  it.each([
    ['site-reader-gl.spec.ts', true],
    ['dir/kit-personal-site-reader-gl.spec.ts', true],
    ['reader-gl.spec.ts', true],
    ['site-reader.spec.ts', false],
    ['reader-gl.spec.ts.bak', false],
  ])('%s → %s', (file, expected) => {
    expect(SPLIT_BY_LOCATION.test(file)).toBe(expected)
  })
})

describe('unitWeights', () => {
  it('weighs files by their recorded locations, else tests × the recorded mean', () => {
    const counts = new Map([
      ['known.spec.ts:1', 2],
      ['known.spec.ts:9', 1],
      ['new.spec.ts:1', 3],
    ])

    const weights = unitWeights(counts, {
      'known.spec.ts:1': 10,
      'known.spec.ts:9': 20,
      'gone.spec.ts:1': 500,
    })

    expect([...weights]).toEqual([
      ['known.spec.ts', 30],
      ['new.spec.ts', 30],
    ])
  })

  it('keeps reader-gl locations apart as units of their own', () => {
    const counts = new Map([
      ['site-reader-gl.spec.ts:5', 1],
      ['site-reader-gl.spec.ts:40', 2],
      ['a.spec.ts:1', 1],
    ])

    const weights = unitWeights(counts, {
      'site-reader-gl.spec.ts:5': 90,
      'a.spec.ts:1': 2,
    })

    expect([...weights]).toEqual([
      ['site-reader-gl.spec.ts:5', 90],
      ['site-reader-gl.spec.ts:40', 2 * 46],
      ['a.spec.ts', 2],
    ])
  })

  it('weighs each test 1 s when nothing listed has a record', () => {
    const weights = unitWeights(new Map([['new.spec.ts:1', 4]]), {})

    expect(weights.get('new.spec.ts')).toBe(4)
  })
})

describe('assignShards', () => {
  it('puts the longest units first on the least-loaded shard', () => {
    const weights = new Map([
      ['a.spec.ts', 1],
      ['b.spec.ts', 8],
      ['c.spec.ts', 5],
      ['d.spec.ts', 4],
      ['e.spec.ts', 2],
    ])

    // b 8 → 0; c 5 → 1; d 4 → 1 (9); e 2 → 0 (10); a 1 → 1 (10).
    expect(assignShards(weights, 2)).toEqual([
      { units: ['b.spec.ts', 'e.spec.ts'], load: 10 },
      { units: ['a.spec.ts', 'c.spec.ts', 'd.spec.ts'], load: 10 },
    ])
  })

  it('breaks weight ties by name and shard ties by index, whatever the input order', () => {
    const forward = new Map([
      ['a.spec.ts', 3],
      ['b.spec.ts', 3],
      ['c.spec.ts', 3],
    ])
    const backward = new Map([...forward].reverse())

    expect(assignShards(forward, 2).map((shard) => shard.units)).toEqual([
      ['a.spec.ts', 'c.spec.ts'],
      ['b.spec.ts'],
    ])
    expect(assignShards(backward, 2)).toEqual(assignShards(forward, 2))
  })

  it('places every unit exactly once', () => {
    const weights = new Map(
      Array.from({ length: 23 }, (_, i) => [`f${String(i)}.spec.ts`, i % 7]),
    )

    const shards = assignShards(weights, 5)

    expect(shards.flatMap((shard) => shard.units).sort()).toEqual(
      [...weights.keys()].sort(),
    )
  })

  it.each([
    [1, 2, '1 units for 2 shards'],
    [1, 0, '1 units for 0 shards'],
  ])('refuses %i unit(s) for %i shards', (units, n, message) => {
    const weights = new Map(
      Array.from({ length: units }, (_, i) => [`f${String(i)}`, 1]),
    )

    expect(() => assignShards(weights, n)).toThrow(message)
  })
})

describe('unitFilter', () => {
  it('anchors the path under e2e/ and escapes regex characters', () => {
    const filter = new RegExp(unitFilter('dir/a.b(1).spec.ts'))

    expect(unitFilter('a.spec.ts')).toBe('/e2e/a\\.spec\\.ts$')
    expect(filter.test('/repo/e2e/dir/a.b(1).spec.ts')).toBe(true)
    expect(filter.test('/repo/e2e/dir/aXb(1).spec.ts')).toBe(false)
    expect(filter.test('/repo/e2e/xdir/a.b(1).spec.ts')).toBe(false)
    expect(filter.test('/repo/e2e/dir/a.b(1).spec.ts.bak')).toBe(false)
  })

  it('keeps the line of a spec location after the file regex', () => {
    expect(unitFilter('dir/gl.spec.ts:593')).toBe(
      '/e2e/dir/gl\\.spec\\.ts$:593',
    )
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
    'a.spec.ts': one,
    'b.spec.ts': [[[0]], [[0]]],
    'c.spec.ts': one,
  })

  /** @param {string} shard */
  const pick = (shard) => [
    'pick',
    '--list',
    join(dir, 'list.json'),
    '--shard',
    shard,
  ]

  it('pick prints the filters of one shard', () => {
    const { lines, io } = setup({
      'list.json': listing,
      'durations.json': {
        'a.spec.ts:1': 9,
        'b.spec.ts:1': 2,
        'b.spec.ts:2': 2,
        'c.spec.ts:1': 4,
      },
    })

    const first = main(pick('1/2'), io)
    const firstLines = lines.splice(0)
    const second = main(
      ['pick', '--shard', '2/2', '--list', join(dir, 'list.json')],
      io,
    )

    expect([first, second]).toEqual([0, 0])
    expect(firstLines).toEqual([unitFilter('a.spec.ts')])
    expect(lines).toEqual([unitFilter('b.spec.ts'), unitFilter('c.spec.ts')])
  })

  it('pick spreads the locations of a reader-gl file over shards', () => {
    const { lines, io } = setup({
      'list.json': report({
        'site-reader-gl.spec.ts': [[[0]], [[0]]],
        'a.spec.ts': one,
      }),
      'durations.json': {
        'site-reader-gl.spec.ts:1': 100,
        'site-reader-gl.spec.ts:2': 100,
        'a.spec.ts:1': 2,
      },
    })

    main(pick('2/3'), io)

    expect(lines).toEqual([unitFilter('site-reader-gl.spec.ts:2')])
  })

  it('pick reads the committed durations file by default', () => {
    const { lines, io } = setup({
      'list.json': report({
        'zz-unrecorded-a.spec.ts': [[[0], [0]]],
        'zz-unrecorded-b.spec.ts': one,
      }),
    })

    const code = main(pick('2/2'), { out: io.out })

    expect(code).toBe(0)
    expect(lines).toEqual([unitFilter('zz-unrecorded-b.spec.ts')])
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
      'report.json': report({ 'a.spec.ts': one, 'b.spec.ts': [[[0]], [[0]]] }),
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
      'report.json': report({
        'b.spec.ts': [[[1500]]],
        'a.spec.ts': [[[200]]],
      }),
    })

    const code = main(['record', '--report', join(dir, 'report.json')], io)

    expect(code).toBe(0)
    expect(lines).toEqual(['wrote 2 locations'])
    expect(readFileSync(io.durationsPath, 'utf8')).toBe(
      '{\n  "a.spec.ts:1": 0.2,\n  "b.spec.ts:1": 1.5\n}\n',
    )
  })

  it('runs as a command and sets the exit code', async () => {
    setup({ 'list.json': listing, 'report.json': listing })
    const argv = process.argv
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    process.argv = [
      argv[0],
      join(process.cwd(), 'scripts/e2e-shard.mjs'),
      'verify',
      '--list',
      join(dir, 'list.json'),
      '--report',
      join(dir, 'report.json'),
    ]

    try {
      vi.resetModules()
      await import('./e2e-shard.mjs')

      expect(log).toHaveBeenCalledWith('e2e shards cover all 3 listed files')
      expect(process.exitCode).toBe(0)
    } finally {
      process.argv = argv
      process.exitCode = undefined
      log.mockRestore()
    }
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
