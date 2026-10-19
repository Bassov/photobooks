import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  companionPathsFor,
  compareItemCriteria,
  compareTestWeakening,
  countWeakeningMarkers,
  extractConfigBool,
  hasOwnerApprovedScopeChange,
  inventoryAllTitles,
  isAllowedItemEdit,
  isDeferralRoadmapText,
  isTrackedTestPath,
  parseTestFile,
  slugFromBranch,
} from './check-test-weakening.mjs'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('parseTestFile', () => {
  it('detects skip/only/todo/fixme and titles with body hash', () => {
    const src = `
import { test, it, describe } from 'vitest'
test('keeps running', () => { expect(1).toBe(1) })
test.skip('skipped one', () => { expect(1).toBe(1) })
it.only('focused', () => {})
it.todo('later')
test.fixme('broken', () => {})
`
    const p = parseTestFile(src, 'x.test.ts')
    expect(p.titles.map((t) => t.title)).toContain('keeps running')
    expect(p.weakening.map((w) => w.suffix).sort()).toEqual(
      ['fixme', 'only', 'skip', 'todo'].sort(),
    )
  })

  it('detects describe.configure retries and per-test retries', () => {
    const src = `
import { test } from '@playwright/test'
test.describe.configure({ retries: 3 })
test('with retries', { retries: 2 }, async () => {})
test('plain', async () => {})
`
    const p = parseTestFile(src, 'e2e/x.spec.ts')
    expect(p.retries).toBe(2)
    expect(p.titles.map((t) => t.title)).toEqual(['with retries', 'plain'])
  })

  it('rename keeps same body hash', () => {
    const body = '() => { expect(1).toBe(1) }'
    const a = parseTestFile(`test('old', ${body})`, 'a.test.ts')
    const b = parseTestFile(`test('new', ${body})`, 'a.test.ts')
    expect(a.titles[0].bodyHash).toBe(b.titles[0].bodyHash)
  })
})

describe('path helpers', () => {
  it('tracks vitest/scripts/e2e test paths', () => {
    expect(isTrackedTestPath('src/foo/bar.test.ts')).toBe(true)
    expect(isTrackedTestPath('scripts/check-gate-ratchet.test.mjs')).toBe(true)
    expect(isTrackedTestPath('e2e/filmstrip.spec.ts')).toBe(true)
    expect(isTrackedTestPath('src/foo.ts')).toBe(false)
  })

  it('companionPathsFor strips test/spec suffix', () => {
    expect(companionPathsFor('src/foo/bar.test.ts')).toContain('src/foo/bar.ts')
    expect(companionPathsFor('scripts/x.test.mjs')).toContain('scripts/x.mjs')
    expect(companionPathsFor('e2e/filmstrip.spec.ts')).toContain(
      'src/filmstrip.ts',
    )
  })
})

describe('extractConfigBool / approval / slug', () => {
  it('reads true/false/other', () => {
    expect(extractConfigBool('allowOnly: false,', 'allowOnly')).toBe('false')
    expect(extractConfigBool('forbidOnly: true,', 'forbidOnly')).toBe('true')
    expect(extractConfigBool('forbidOnly: isCi,', 'forbidOnly')).toBe('other')
    expect(extractConfigBool('x: 1', 'allowOnly')).toBe(null)
  })

  it('detects owner approval line', () => {
    expect(
      hasOwnerApprovedScopeChange(
        'Hello\nOwner-approved scope change: https://example.com\n',
      ),
    ).toBe(true)
    expect(hasOwnerApprovedScopeChange('Owner-approved scope change:')).toBe(
      false,
    )
  })

  it('slugFromBranch', () => {
    expect(slugFromBranch('feat/gate-weakening-guard')).toBe(
      'gate-weakening-guard',
    )
    expect(slugFromBranch('main')).toBe(null)
  })
})

describe('item criteria helpers', () => {
  it('allows checkbox ticks, status done, Done note', () => {
    const base = `# item\nStatus: open\n- [ ] A\n- [ ] B\n`
    const head = `# item\nStatus: done\n- [x] A\n- [x] B\n\n## Done\nShipped.\n`
    expect(isAllowedItemEdit(base, head)).toBe(true)
  })

  it('allows inserting Status: done when base had none', () => {
    const base = `# item\nTitle: t\n\n## Scope\n- [ ] A\n`
    const head = `# item\nTitle: t\nStatus: done\n\n## Scope\n- [x] A\n\n## Done note\nShipped.\n`
    expect(isAllowedItemEdit(base, head)).toBe(true)
  })

  it('rejects Done-when rewrite', () => {
    const base = `## Scope\n- **Done when:** keep bar\n`
    const head = `## Scope\n- **Done when:** weaker bar\n`
    expect(isAllowedItemEdit(base, head)).toBe(false)
  })

  it('detects deferral text', () => {
    expect(
      isDeferralRoadmapText(
        'defer mutation bar for gate-weakening-guard',
        'gate-weakening-guard',
      ),
    ).toBe(true)
    expect(isDeferralRoadmapText('unrelated note', 'other')).toBe(false)
  })
})

describe('compareTestWeakening', () => {
  it('fails on added skip', () => {
    /** @type {{ ruleId: string, message: string }[]} */
    const v = []
    compareTestWeakening(
      { 'src/a.test.ts': `test('a', () => {})\n` },
      { 'src/a.test.ts': `test.skip('a', () => {})\n` },
      (ruleId, message) => v.push({ ruleId, message }),
    )
    expect(v.some((x) => x.ruleId === 'test-skip-added')).toBe(true)
  })

  it('fails on deleted title; passes rename with same body', () => {
    const body = '() => { return 1 }'
    /** @type {{ ruleId: string, message: string }[]} */
    const del = []
    compareTestWeakening(
      { 'e2e/a.spec.ts': `test('old title', ${body})\n` },
      { 'e2e/a.spec.ts': `test('kept', () => {})\n` },
      (ruleId, message) => del.push({ ruleId, message }),
    )
    expect(del.some((x) => x.ruleId === 'test-title-removed')).toBe(true)

    /** @type {{ ruleId: string, message: string }[]} */
    const ren = []
    compareTestWeakening(
      { 'e2e/a.spec.ts': `test('old title', ${body})\n` },
      { 'e2e/a.spec.ts': `test('new title', ${body})\n` },
      (ruleId, message) => ren.push({ ruleId, message }),
    )
    expect(ren.some((x) => x.ruleId === 'test-title-removed')).toBe(false)
  })

  it('fails file delete alone; passes with companion', () => {
    /** @type {{ ruleId: string, message: string }[]} */
    const alone = []
    compareTestWeakening(
      {
        'src/foo.test.ts': `test('a', () => {})\n`,
        'src/foo.ts': `export const x = 1\n`,
      },
      { 'src/foo.ts': `export const x = 1\n` },
      (ruleId, message) => alone.push({ ruleId, message }),
    )
    expect(alone.some((x) => x.ruleId === 'test-title-removed')).toBe(true)

    /** @type {{ ruleId: string, message: string }[]} */
    const both = []
    compareTestWeakening(
      {
        'src/foo.test.ts': `test('a', () => {})\n`,
        'src/foo.ts': `export const x = 1\n`,
      },
      {},
      (ruleId, message) => both.push({ ruleId, message }),
    )
    expect(both.some((x) => x.ruleId === 'test-title-removed')).toBe(false)
  })

  it('fails allowOnly/forbidOnly weakening', () => {
    /** @type {{ ruleId: string, message: string }[]} */
    const v = []
    compareTestWeakening(
      {
        'vite.config.ts': `export default { test: { allowOnly: false } }\n`,
        'playwright.config.ts': `export default { forbidOnly: true }\n`,
      },
      {
        'vite.config.ts': `export default { test: { allowOnly: true } }\n`,
        'playwright.config.ts': `export default { forbidOnly: false }\n`,
      },
      (ruleId, message) => v.push({ ruleId, message }),
    )
    expect(v.some((x) => x.ruleId === 'allow-only-weaker')).toBe(true)
    expect(v.some((x) => x.ruleId === 'forbid-only-weaker')).toBe(true)
  })
})

describe('compareItemCriteria', () => {
  const item = 'docs/roadmap/M2.1/demo-slug.md'
  const baseItem = `# demo-slug\nStatus: open\n- [ ] Scope A\n- **Done when:** hard bar\n`

  it('fails Done-when rewrite without approval', () => {
    /** @type {{ ruleId: string, message: string }[]} */
    const v = []
    compareItemCriteria(
      { [item]: baseItem },
      { [item]: baseItem.replace('hard bar', 'soft bar') },
      { branch: 'feat/demo-slug', prBody: '' },
      (ruleId, message) => v.push({ ruleId, message }),
    )
    expect(v.some((x) => x.ruleId === 'item-criteria-loosened')).toBe(true)
  })

  it('passes checkbox + Done note', () => {
    /** @type {{ ruleId: string, message: string }[]} */
    const v = []
    const head = `# demo-slug\nStatus: done\n- [x] Scope A\n- **Done when:** hard bar\n\n## Done\nNote.\n`
    compareItemCriteria(
      { [item]: baseItem },
      { [item]: head },
      { branch: 'feat/demo-slug', prBody: '' },
      (ruleId, message) => v.push({ ruleId, message }),
    )
    expect(v.some((x) => x.ruleId === 'item-criteria-loosened')).toBe(false)
  })

  it('fails deferral item; passes with owner approval', () => {
    /** @type {{ ruleId: string, message: string }[]} */
    const v = []
    compareItemCriteria(
      { [item]: baseItem },
      {
        [item]: baseItem,
        'docs/roadmap/M2.1/demo-slug-defer.md':
          'defer mutation coverage for demo-slug\n',
      },
      { branch: 'feat/demo-slug', prBody: '' },
      (ruleId, message) => v.push({ ruleId, message }),
    )
    expect(v.some((x) => x.ruleId === 'item-criteria-loosened')).toBe(true)

    /** @type {{ ruleId: string, message: string }[]} */
    const ok = []
    compareItemCriteria(
      { [item]: baseItem },
      {
        [item]: baseItem.replace('hard bar', 'soft bar'),
        'docs/roadmap/M2.1/demo-slug-defer.md':
          'defer mutation for demo-slug\n',
      },
      {
        branch: 'feat/demo-slug',
        prBody: 'Owner-approved scope change: https://example.com/x',
      },
      (ruleId, message) => ok.push({ ruleId, message }),
    )
    expect(ok.some((x) => x.ruleId === 'item-criteria-loosened')).toBe(false)
  })
})

describe('real repo inventory', () => {
  it('parses non-empty titles from real test files', () => {
    const files = {}
    const walk = (dir, relBase = '') => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (
          ent.name === 'node_modules' ||
          ent.name === '.git' ||
          ent.name === 'dist'
        ) {
          continue
        }
        const rel = relBase ? `${relBase}/${ent.name}` : ent.name
        const abs = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(abs, rel)
        else if (ent.isFile() && isTrackedTestPath(rel)) {
          files[rel] = fs.readFileSync(abs, 'utf8')
        }
      }
    }
    walk(path.join(REPO_ROOT, 'src'), 'src')
    walk(path.join(REPO_ROOT, 'scripts'), 'scripts')
    walk(path.join(REPO_ROOT, 'e2e'), 'e2e')
    const titles = inventoryAllTitles(files)
    expect(titles.length).toBeGreaterThan(50)
    expect(titles.some((t) => t.path.startsWith('src/'))).toBe(true)
    expect(titles.some((t) => t.path.startsWith('e2e/'))).toBe(true)
    // sanity: markers detector runs without throwing
    expect(countWeakeningMarkers(files)).toBeGreaterThanOrEqual(0)
  })
})
