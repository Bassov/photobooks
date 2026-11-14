import { describe, expect, it } from 'vitest'
import {
  extractE2eRefs,
  extractSrcIds,
  formatSelection,
  hunkLinesByFile,
  main,
  matchedIds,
  parseMax,
  resolveImports,
  selectRelated,
} from './e2e-related.mjs'

/** @param {string} path @param {string[]} body */
function fileDiff(path, body) {
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    ...body,
  ].join('\n')
}

const PANEL_DIFF = fileDiff('src/editor/Panel.tsx', [
  '@@ -10,5 +10,5 @@ export function Panel() {',
  '   return (',
  '-    <div data-testid="panel-old">',
  '+    <div data-testid="panel-new">',
  '       <Row testId="panel-row" />',
  '\\ No newline at end of file',
])

describe('hunkLinesByFile', () => {
  it('keeps added, removed and context hunk lines of src ts/tsx/css files only', () => {
    const diff = [
      PANEL_DIFF,
      fileDiff('src/editor/panel.css', [
        '@@ -1 +1 @@',
        '+[data-testid="css-id"] {}',
      ]),
      fileDiff('e2e/panel.spec.ts', [
        '@@ -1 +1 @@',
        "+getByTestId('e2e-only')",
      ]),
      fileDiff('src/editor/data.json', [
        '@@ -1 +1 @@',
        '+"data-testid": "json-id"',
      ]),
    ].join('\n')

    const files = hunkLinesByFile(diff)

    expect([...files.keys()]).toEqual([
      'src/editor/Panel.tsx',
      'src/editor/panel.css',
    ])
    expect(files.get('src/editor/Panel.tsx')).toEqual([
      '  return (',
      '    <div data-testid="panel-old">',
      '    <div data-testid="panel-new">',
      '      <Row testId="panel-row" />',
    ])
  })

  it('reads no ids from file headers or lines outside the hunks', () => {
    const diff = [
      'diff --git a/src/a.tsx b/src/a.tsx',
      '--- a/src/a.tsx',
      '+++ b/src/a.tsx',
      '@@ -1 +1 @@',
      '+<p data-testid="in-hunk" />',
    ].join('\n')

    const ids = extractSrcIds([...hunkLinesByFile(diff).values()].flat())

    expect([...ids]).toEqual(['in-hunk'])
  })
})

describe('extractSrcIds', () => {
  it('reads literal, prop, object and css ids', () => {
    const ids = extractSrcIds([
      '<div data-testid="a-literal">',
      "<Sec testId='a-prop' />",
      "{ testId: 'a-object' }",
      '<Credit testid="a-lower" />',
      "'data-testid': dataTestId = 'a-default',",
      "<b data-testid={'a-braced'} />",
      '[data-testid="a-css"] { color: red }',
    ])

    expect([...ids].sort()).toEqual([
      'a-braced',
      'a-css',
      'a-default',
      'a-literal',
      'a-lower',
      'a-object',
      'a-prop',
    ])
  })

  it('turns a template literal into its prefix before ${', () => {
    const ids = extractSrcIds([
      'data-testid={`library-book-${book.id}`}',
      'testId={`plain-template`}',
      'data-testid={`${kind}-row`}',
    ])

    expect([...ids].sort()).toEqual(['library-book-*', 'plain-template'])
  })
})

describe('extractE2eRefs', () => {
  it('reads getByTestId and data-testid selectors, prefixes for templates and ^=', () => {
    const refs = extractE2eRefs(
      [
        "page.getByTestId('zoom-menu')",
        'page.getByTestId("site-name")',
        'page.getByTestId(`adjust-${key}`)',
        'page.locator(\'[data-testid="spread-view"]\')',
        'page.locator(\'[data-testid^="spread-list-item-"]\')',
        'page.locator(`[data-testid="${id}"]`)',
      ].join('\n'),
    )

    expect([...refs].sort()).toEqual([
      'adjust-*',
      'site-name',
      'spread-list-item-*',
      'spread-view',
      'zoom-menu',
    ])
  })
})

describe('matchedIds', () => {
  it('matches exact ids exactly and prefixes on either side by startsWith', () => {
    const src = new Set([
      'zoom-menu',
      'library-book-*',
      'adjust-gain',
      'cover-*',
      'other',
    ])
    const refs = new Set([
      'zoom-menu',
      'library-book-42',
      'adjust-*',
      'cover-text-*',
    ])

    expect(matchedIds(src, refs)).toEqual([
      'zoom-menu',
      'library-book-*',
      'adjust-gain',
      'cover-*',
    ])
    expect(matchedIds(new Set(['zoom']), new Set(['zoom-menu']))).toEqual([])
  })
})

describe('resolveImports', () => {
  it('resolves relative imports to known e2e files', () => {
    const files = new Set([
      'e2e/fixtures/panel.ts',
      'e2e/fixtures/png.mjs',
      'e2e/fixtures/index.ts',
    ])
    const text = [
      "import { open } from './fixtures/panel'",
      "import { png } from './fixtures/png.mjs'",
      "import { x } from './fixtures'",
      "import { y } from './fixtures/panel.js'",
      "import { expect } from '@playwright/test'",
      "const lazy = await import('./missing')",
    ].join('\n')

    expect(resolveImports('e2e/a.spec.ts', text, files)).toEqual([
      'e2e/fixtures/panel.ts',
      'e2e/fixtures/png.mjs',
      'e2e/fixtures/index.ts',
      'e2e/fixtures/panel.ts',
    ])
  })
})

describe('selectRelated', () => {
  const srcIds = new Set(['a', 'b', 'c', 'row-*'])

  it('ranks by matched ids, then path, and drops specs over the cap', () => {
    const e2eFiles = new Map([
      ['e2e/one.spec.ts', "getByTestId('a')"],
      [
        'e2e/three.spec.ts',
        "getByTestId('a'); getByTestId('b'); getByTestId('row-1')",
      ],
      ['e2e/two-b.spec.ts', "getByTestId('b'); getByTestId('c')"],
      ['e2e/two-a.spec.ts', "getByTestId('a'); getByTestId('c')"],
      ['e2e/none.spec.ts', "getByTestId('unrelated')"],
    ])

    const result = selectRelated({ srcIds, e2eFiles, max: 3 })

    expect(result.selected.map((s) => s.path)).toEqual([
      'e2e/three.spec.ts',
      'e2e/two-a.spec.ts',
      'e2e/two-b.spec.ts',
    ])
    expect(result.selected[0].ids).toEqual(['a', 'b', 'row-*'])
    expect(result.dropped).toEqual([{ path: 'e2e/one.spec.ts', ids: ['a'] }])
    expect(result.skipped).toEqual([])
  })

  it('skips flaky or changed specs and never selects support files', () => {
    const e2eFiles = new Map([
      ['e2e/flaky.spec.ts', "getByTestId('a')"],
      ['e2e/ok.spec.ts', "getByTestId('a')"],
      ['e2e/fixtures/helper.ts', "getByTestId('a')"],
    ])

    const result = selectRelated({
      srcIds,
      e2eFiles,
      skip: new Set(['e2e/flaky.spec.ts']),
    })

    expect(result.selected.map((s) => s.path)).toEqual(['e2e/ok.spec.ts'])
    expect(result.skipped).toEqual(['e2e/flaky.spec.ts'])
  })

  it('credits a spec with the ids of the support files it reaches', () => {
    const e2eFiles = new Map([
      [
        'e2e/user.spec.ts',
        "import { open } from './fixtures/open'\ngetByTestId('a')",
      ],
      [
        'e2e/fixtures/open.ts',
        "import { deep } from './deep'\nexport const open = 1",
      ],
      [
        'e2e/fixtures/deep.ts',
        "import { open } from './open'\ngetByTestId('b')",
      ],
    ])

    const result = selectRelated({ srcIds, e2eFiles })

    expect(result.selected).toEqual([
      { path: 'e2e/user.spec.ts', ids: ['a', 'b'] },
    ])
  })
})

describe('parseMax', () => {
  it('reads a positive integer and falls back to 12', () => {
    expect(parseMax('3')).toBe(3)
    expect(parseMax(undefined)).toBe(12)
    expect(parseMax('0')).toBe(12)
    expect(parseMax('2.5')).toBe(12)
  })
})

describe('formatSelection', () => {
  it('prints selected, dropped and skipped lists', () => {
    const text = formatSelection({
      selected: [{ path: 'e2e/a.spec.ts', ids: ['x', 'y'] }],
      dropped: [{ path: 'e2e/b.spec.ts', ids: ['x'] }],
      skipped: ['e2e/c.spec.ts'],
    })

    expect(text).toBe(
      [
        'related-e2e: selected 1',
        '  e2e/a.spec.ts (2: x, y)',
        'related-e2e: dropped 1 over the cap',
        '  e2e/b.spec.ts (1: x)',
        'related-e2e: skipped 1 (flaky or changed)',
        '  e2e/c.spec.ts',
        '',
      ].join('\n'),
    )
  })

  it('omits empty dropped and skipped lists', () => {
    expect(formatSelection({ selected: [], dropped: [], skipped: [] })).toBe(
      'related-e2e: selected 0\n',
    )
  })
})

describe('main', () => {
  const files = {
    'e2e/panel.spec.ts': "getByTestId('panel-new')",
    'e2e/changed.spec.ts': "getByTestId('panel-row')",
    'e2e/flaky.spec.ts': "getByTestId('panel-row')",
    'e2e/fresh.spec.ts': "getByTestId('panel-row')",
    'e2e/burn-in-fixtures/x.spec.ts': "getByTestId('panel-new')",
    'e2e/notes.md': "getByTestId('panel-new')",
    'src/editor/New.tsx': '<p data-testid="fresh-id" />',
  }

  /** @param {Record<string, string>} [extra] */
  function harness(extra = {}) {
    /** @type {string[][]} */
    const gitCalls = []
    /** @type {{ args: string[], env: NodeJS.ProcessEnv }[]} */
    const spawns = []
    const out = []
    const logs = []
    let clock = 1000
    const io = {
      /** @param {string[]} args */
      git: (args) => {
        gitCalls.push(args)
        const key = args.join(' ')
        if (
          key === 'merge-base origin/main HEAD' ||
          key === 'merge-base phase HEAD'
        ) {
          return ['base-sha\n']
        }
        if (args[0] === 'diff' && args[1] === '-U3') return [PANEL_DIFF]
        if (key === 'ls-files --others --exclude-standard -- src') {
          return ['src/editor/New.tsx\n']
        }
        if (key === 'diff --name-only base-sha -- e2e')
          return ['e2e/changed.spec.ts\n']
        if (key === 'ls-files --others --exclude-standard -- e2e')
          return ['e2e/fresh.spec.ts\n']
        if (key === 'ls-files -- e2e') {
          return [
            Object.keys(files)
              .filter((p) => p.startsWith('e2e/'))
              .join('\n'),
          ]
        }
        return ['']
      },
      /** @param {string} path */
      readFile: (path) => ({ ...files, ...extra })[path] ?? '',
      loadFlaky: () => ['e2e/flaky.spec.ts'],
      /** @param {string} _file @param {string[]} args @param {{ env: NodeJS.ProcessEnv }} opts */
      spawn: (_file, args, opts) => {
        spawns.push({ args, env: opts.env })
        clock += 2500
        return /** @type {any} */ (harness.result)
      },
      /** @param {string} text */
      writeLog: (text) => logs.push(text),
      /** @param {string} text */
      write: (text) => out.push(text),
      now: () => clock,
    }
    return { io, gitCalls, spawns, out, logs }
  }
  /** @type {{ status: number | null, stdout: string, stderr: string }} */
  harness.result = { status: 0, stdout: '··\n', stderr: '' }

  it('diffs the working tree vs the merge-base, skips changed and flaky specs, runs the rest', () => {
    harness.result = { status: 0, stdout: '··\n', stderr: '' }
    const { io, gitCalls, spawns, out, logs } = harness()

    const code = main([], { PATH: '/bin' }, io)

    expect(code).toBe(0)
    expect(gitCalls).toContainEqual(['diff', '-U3', 'base-sha', '--', 'src'])
    expect(spawns).toHaveLength(1)
    const args = spawns[0].args
    expect(args.slice(1, 6)).toEqual([
      'playwright',
      'test',
      '--project=chromium',
      '--workers=1',
      '--pass-with-no-tests',
    ])
    expect(args.slice(6)).toEqual(['e2e/panel.spec.ts', '--reporter=dot'])
    expect(spawns[0].env.PATH).toMatch(/node_modules[/\\]\.bin.+\/bin$/)
    expect(logs).toEqual(['··\n'])
    const text = out.join('')
    expect(text).toContain('related-e2e: 4 changed test id(s)')
    expect(text).toContain('related-e2e: skipped 3 (flaky or changed)')
    expect(text).toContain('related-e2e: 1 passed (2.5s)')
  })

  it('reads ids from untracked src files and honours STRYKER_DIFF_BASE', () => {
    const { io, gitCalls, out } = harness({
      'e2e/panel.spec.ts': "getByTestId('fresh-id')",
    })

    expect(main(['--list'], { STRYKER_DIFF_BASE: 'phase' }, io)).toBe(0)

    expect(gitCalls[0]).toEqual(['merge-base', 'phase', 'HEAD'])
    expect(out.join('')).toContain('  e2e/panel.spec.ts (1: fresh-id)')
  })

  it('replays a range without skipping changed specs and caps via E2E_RELATED_MAX', () => {
    const { io, gitCalls, spawns, out } = harness()

    const code = main(
      ['--list', '--range', 'a..b'],
      { E2E_RELATED_MAX: '1' },
      io,
    )

    expect(code).toBe(0)
    expect(gitCalls).toContainEqual(['diff', '-U3', 'a..b', '--', 'src'])
    expect(gitCalls.some((args) => args[0] === 'merge-base')).toBe(false)
    expect(spawns).toEqual([])
    const text = out.join('')
    expect(text).toContain(
      'related-e2e: selected 1\n  e2e/changed.spec.ts (1: panel-row)',
    )
    expect(text).toContain('related-e2e: dropped 2 over the cap')
    expect(text).toContain(
      'related-e2e: skipped 1 (flaky or changed)\n  e2e/flaky.spec.ts',
    )
  })

  it('reports no targets without running Playwright', () => {
    const { io, spawns, out } = harness({
      'e2e/panel.spec.ts': "getByTestId('nothing')",
    })

    expect(main([], {}, io)).toBe(0)

    expect(spawns).toEqual([])
    expect(out.join('')).toContain('related-e2e: no targets\n')
  })

  it('fails with the log tail when Playwright fails', () => {
    harness.result = {
      status: 1,
      stdout: Array.from({ length: 50 }, (_, i) => `line ${String(i)}`).join(
        '\n',
      ),
      stderr: '\nboom\n',
    }
    const { io, out } = harness()

    expect(main([], {}, io)).toBe(1)

    const text = out.join('')
    expect(text).not.toContain('line 10\n')
    expect(text).toContain('line 11\n')
    expect(text).toContain('boom\n')
    expect(text).toContain(
      'related-e2e: 1 failed (exit 1, 2.5s); full log: .cache/checks/e2e-related.log',
    )
  })
})
