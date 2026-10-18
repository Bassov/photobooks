import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
import {
  AgentError,
  branchPrefixForItem,
  collectSkipSlugs,
  cmdPreflight,
  defaultExec,
  isFailingBucket,
  isFeatureBranch,
  isPassingBucket,
  main,
  mustOk,
  mustOkDiffNoIndex,
  parseArgs,
  parseInstructions,
  parseRoadmapNext,
  parseTouchSetPaths,
  readNvmrcMajor,
  readPushFailures,
  resolvePureAddIndexConflict,
  run,
  runIdFromCheckLink,
  slugFromBranch,
  slugFromFeatFix,
  stripAnsi,
  switchFeatureBranch,
  branchHeldInOtherWorktree,
  gitPath,
  tailOutput,
  tryResolveTrivialConflicts,
  mergeOriginMainIfNeeded,
  writePushFailures,
  pushFailPath,
} from './agent.mjs'

const tmpDirs = []
afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop(), { recursive: true, force: true })
  }
})

function tmpRoot(withGit = false) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cli-'))
  tmpDirs.push(d)
  fs.writeFileSync(path.join(d, '.nvmrc'), '22\n')
  fs.mkdirSync(path.join(d, 'openspec', 'changes'), { recursive: true })
  if (withGit) {
    fs.mkdirSync(path.join(d, '.git'), { recursive: true })
  }
  return d
}

function gitInitRepo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-git-'))
  tmpDirs.push(d)
  execFileSync('git', ['init'], { cwd: d, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 't@t.com'], {
    cwd: d,
    stdio: 'ignore',
  })
  execFileSync('git', ['config', 'user.name', 't'], { cwd: d, stdio: 'ignore' })
  fs.writeFileSync(path.join(d, '.nvmrc'), '22\n')
  fs.writeFileSync(path.join(d, 'tracked.txt'), 'base\n')
  execFileSync('git', ['add', '.'], { cwd: d, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: d, stdio: 'ignore' })
  return d
}

function fakeExec(handlers) {
  return (file, args, _opts = {}) => {
    const key = `${file} ${args.join(' ')}`
    for (const [pattern, res] of handlers) {
      if (
        (typeof pattern === 'string' && key.includes(pattern)) ||
        (pattern instanceof RegExp && pattern.test(key))
      ) {
        const out = typeof res === 'function' ? res(file, args) : res
        return {
          code: out.code ?? 0,
          stdout: out.stdout ?? '',
          stderr: out.stderr ?? '',
        }
      }
    }
    // Default empty claimed-set sources so legacy preflight fixtures stay green.
    if (key.includes('git branch --format'))
      return { code: 0, stdout: '', stderr: '' }
    if (key.includes('git worktree list --porcelain'))
      return { code: 0, stdout: '', stderr: '' }
    if (key.includes('git rev-parse --git-path')) {
      const file = args[args.length - 1] ?? 'unknown'
      return { code: 0, stdout: `.git/${file}\n`, stderr: '' }
    }
    // Finish happy-path fixtures: already based on origin/main.
    if (key.includes('git merge-base --is-ancestor'))
      return { code: 0, stdout: '', stderr: '' }
    if (key.includes('git fetch origin'))
      return { code: 0, stdout: '', stderr: '' }
    return { code: 1, stdout: '', stderr: `unhandled: ${key}` }
  }
}

const envOk = [
  ['node -v', { stdout: 'v22.23.3\n' }],
  ['command -v pnpm', { code: 0 }],
]

const HELP_SNIPPETS = [
  'usage: pnpm agent <cmd> [--root <repo>] [--json] [--quiet]',
  'preflight [--slug S] [--skip a,b]',
  'finish --title T --body-file F',
  'review-brief [--change S] [--base REF] [--rules-json',
  'source scripts/agent-env.sh',
  'Prefer --json for machine branching.',
]

describe('parseArgs', () => {
  it('parses bool and value flags including --key=value', () => {
    const o = parseArgs([
      'preflight',
      '--json',
      '--quiet',
      '--skip',
      'a,b',
      '--root',
      '.',
      '--base',
      'origin/main',
    ])
    expect(o).toEqual({
      _: ['preflight'],
      json: true,
      quiet: true,
      skip: 'a,b',
      root: '.',
      base: 'origin/main',
    })
    expect(parseArgs(['finish', '--root=./repo', '--title=Hi'])).toEqual({
      _: ['finish'],
      root: './repo',
      title: 'Hi',
    })
  })

  it('rejects unknown options with exact message', () => {
    expect(() => parseArgs(['x', '--nope'])).toThrow(AgentError)
    expect(() => parseArgs(['x', '--nope'])).toThrow('unknown option --nope')
  })

  it('rejects missing values with exact message', () => {
    expect(() => parseArgs(['x', '--root'])).toThrow(
      '--root needs a value (use --root=<value> for values starting with --)',
    )
    expect(() => parseArgs(['x', '--root', '--json'])).toThrow(
      '--root needs a value (use --root=<value> for values starting with --)',
    )
  })
})

describe('stripAnsi / tailOutput', () => {
  it('strips CSI sequences', () => {
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red')
    expect(stripAnsi(null)).toBe('')
    expect(stripAnsi(undefined)).toBe('')
  })

  it('tails last N lines and defaults to 60', () => {
    expect(tailOutput('', '')).toBe('(no output)')
    expect(tailOutput('   ', '  ')).toBe('(no output)')
    expect(tailOutput(null, undefined)).toBe('(no output)')
    expect(tailOutput('a\n'.repeat(100), '', 3)).toBe('a\na\na')
    const lines = Array.from({ length: 100 }, (_, i) => `L${i}`).join('\n')
    expect(tailOutput(lines, '').split('\n')).toHaveLength(60)
    expect(tailOutput(lines, '').split('\n')[0]).toBe('L40')
    expect(tailOutput('out', 'err', 10)).toBe('out\nerr')
  })
})

describe('mustOk', () => {
  it('returns result when code is 0', () => {
    const r = { code: 0, stdout: 'ok', stderr: '' }
    expect(mustOk(r, 'lab')).toBe(r)
  })

  it('throws with tailed streams and preserves exit code', () => {
    try {
      mustOk(
        { code: 7, stdout: 'ELIFECYCLE\n', stderr: 'real error line\n' },
        'verify',
      )
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AgentError)
      expect(e.exitCode).toBe(7)
      expect(e.message).toBe(
        'verify failed (exit 7):\nELIFECYCLE\n\nreal error line',
      )
    }
  })

  it('uses exit 1 when code is falsy but non-zero path', () => {
    try {
      mustOk({ code: undefined, stdout: '', stderr: 'x' }, 'lab')
      expect.unreachable()
    } catch (e) {
      expect(e.exitCode).toBe(1)
      expect(e.message).toBe('lab failed (exit undefined):\nx')
    }
  })
})

describe('parsers', () => {
  it('parseRoadmapNext JSON and text forms', () => {
    const j = parseRoadmapNext(
      JSON.stringify({
        slug: 's',
        tag: 'prep',
        title: 't',
        file: 'f',
        milestone: 'M2.1',
        goal: ['g'],
        body: 'body',
      }),
    )
    expect(j).toEqual({
      slug: 's',
      tag: 'prep',
      title: 't',
      file: 'f',
      milestone: 'M2.1',
      goal: ['g'],
      body: 'body',
    })
    const text = parseRoadmapNext(
      [
        'slug: alpha',
        'tag: prep',
        'title: Hello',
        'file: docs/x.md',
        'milestone: M2.1 — Q',
        'goal: one',
        'goal: two',
        '---',
        'body line',
      ].join('\n'),
    )
    expect(text).toEqual({
      slug: 'alpha',
      tag: 'prep',
      title: 'Hello',
      file: 'docs/x.md',
      milestone: 'M2.1 — Q',
      goal: ['one', 'two'],
      body: 'body line',
    })
    const bodyFirst = parseRoadmapNext('---\nslug: s\nrest\n')
    expect(bodyFirst.slug).toBe('s')
    expect(bodyFirst.body).toBe('slug: s\nrest\n')
    const noBody = parseRoadmapNext('slug: only\ntag: prep\n')
    expect(noBody.body).toBeUndefined()
    expect(noBody.tag).toBe('prep')
  })

  it('parseRoadmapNext failure messages', () => {
    expect(() => parseRoadmapNext('{}')).toThrow(
      'roadmap next JSON missing slug',
    )
    expect(() => parseRoadmapNext('not json and no slug')).toThrow(
      'roadmap next produced no slug',
    )
  })

  it('parseInstructions defaults missing fields to null', () => {
    expect(parseInstructions('{"template":"T","rules":["r"]}')).toEqual({
      template: 'T',
      rules: ['r'],
    })
    expect(parseInstructions('{}')).toEqual({ template: null, rules: null })
    expect(() => parseInstructions('nope')).toThrow()
  })

  it('parseTouchSetPaths skips header and ellipsis rows', () => {
    expect(
      parseTouchSetPaths(
        '| `scripts/agent.mjs` | cli |\n| File | Why |\n| `a…b` | skip |\n| `ok.ts` | x |',
      ),
    ).toEqual(['scripts/agent.mjs', 'ok.ts'])
    expect(parseTouchSetPaths('| no-ticks | x |')).toEqual([])
    expect(parseTouchSetPaths('not a table')).toEqual([])
  })
})

describe('branch and check helpers', () => {
  it('branchPrefixForItem', () => {
    expect(branchPrefixForItem({ tag: 'prep', title: 'x' })).toBe('feat')
    expect(branchPrefixForItem({ tag: 'fix', title: 'x' })).toBe('fix')
    expect(branchPrefixForItem({ tag: 'prep', title: 'fix a bug' })).toBe('fix')
    expect(branchPrefixForItem({ tag: 'prep', title: undefined })).toBe('feat')
    expect(branchPrefixForItem({ tag: 'prep' })).toBe('feat')
  })

  it('isFeatureBranch and slugFromBranch', () => {
    expect(isFeatureBranch('feat/x')).toBe(true)
    expect(isFeatureBranch('fix/y')).toBe(true)
    expect(isFeatureBranch('main')).toBe(false)
    expect(isFeatureBranch('feature/x')).toBe(false)
    expect(slugFromBranch('feat/demo')).toBe('demo')
    expect(slugFromBranch('fix/demo')).toBe('demo')
    expect(slugFromBranch('main')).toBe('main')
  })

  it('check buckets and run id', () => {
    expect(isFailingBucket('fail')).toBe(true)
    expect(isFailingBucket('pending')).toBe(true)
    expect(isFailingBucket('pass')).toBe(false)
    expect(isPassingBucket('pass')).toBe(true)
    expect(isPassingBucket('skipping')).toBe(true)
    expect(isPassingBucket('skip')).toBe(true)
    expect(isPassingBucket('neutral')).toBe(true)
    expect(isPassingBucket('fail')).toBe(false)
    expect(runIdFromCheckLink('https://x/actions/runs/12345/job/1')).toBe(
      '12345',
    )
    expect(runIdFromCheckLink(null)).toBe(null)
    expect(runIdFromCheckLink('')).toBe(null)
    expect(runIdFromCheckLink('https://example.com/nope')).toBe(null)
  })
})

describe('nvmrc and push failures', () => {
  it('readNvmrcMajor missing bad and valid', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bare-'))
    tmpDirs.push(bare)
    expect(readNvmrcMajor(bare)).toBe(null)
    fs.writeFileSync(path.join(bare, '.nvmrc'), 'nope\n')
    expect(readNvmrcMajor(bare)).toBe(null)
    fs.writeFileSync(path.join(bare, '.nvmrc'), 'v22.1\n')
    expect(readNvmrcMajor(bare)).toBe(22)
    const root = tmpRoot()
    expect(readNvmrcMajor(root)).toBe(22)
  })

  it('readPushFailures empty corrupt and write roundtrip', () => {
    const root = tmpRoot(true)
    expect(readPushFailures(root)).toEqual({})
    writePushFailures(root, { 'feat/x': 1 })
    expect(readPushFailures(root)).toEqual({ 'feat/x': 1 })
    expect(pushFailPath(root)).toBe(
      path.join(root, '.git', 'agent-finish-push-failures.json'),
    )
    fs.writeFileSync(pushFailPath(root), '{not-json')
    expect(readPushFailures(root)).toEqual({})
  })

  it('writePushFailures requires a git dir', () => {
    const noGit = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-nogit-'))
    tmpDirs.push(noGit)
    expect(() => writePushFailures(noGit, {})).toThrow(
      /git rev-parse --git-path/,
    )
  })

  it('gitPath fails when .git is a file and rev-parse fails', () => {
    const root = tmpRoot()
    fs.writeFileSync(path.join(root, '.git'), 'gitdir: /nonexistent\n')
    expect(() => pushFailPath(root)).toThrow(/git rev-parse --git-path/)
  })

  it('gitPath falls back to .git directory when rev-parse fails', () => {
    const root = tmpRoot(true)
    const p = gitPath(root, 'agent-x.json', () => ({
      code: 1,
      stdout: '',
      stderr: 'nope',
    }))
    expect(p).toBe(path.join(root, '.git', 'agent-x.json'))
  })

  it('pushFailPath uses git-dir in a linked worktree', () => {
    const primary = gitInitRepo()
    execFileSync('git', ['branch', '-M', 'main'], {
      cwd: primary,
      stdio: 'ignore',
    })
    const wt = path.join(primary, '..', `wt-${path.basename(primary)}`)
    tmpDirs.push(wt)
    execFileSync('git', ['worktree', 'add', wt, '-b', 'feat/wt-item'], {
      cwd: primary,
      stdio: 'ignore',
    })
    writePushFailures(wt, { 'feat/wt-item': 1 })
    const p = pushFailPath(wt)
    expect(fs.existsSync(p)).toBe(true)
    expect(readPushFailures(wt)).toEqual({ 'feat/wt-item': 1 })
    expect(p.includes('.git')).toBe(true)
  })
})

describe('preflight', () => {
  it('happy path --json includes body goal milestone', () => {
    const root = tmpRoot()
    const item = {
      slug: 'demo-item',
      tag: 'prep',
      title: 'Fewer calls',
      file: 'docs/roadmap/M2.1/demo-item.md',
      milestone: 'M2.1 — Q',
      goal: ['goal text'],
      body: '## Scope\n- [ ] a',
    }
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git fetch origin', { code: 0 }],
      ['git switch main', { code: 0 }],
      ['git pull --ff-only', { code: 0 }],
      ['gh pr list', { stdout: 'feat/other\n' }],
      ['git branch -r', { stdout: '  origin/feat/remote-one\n' }],
      ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
      ['git switch -c feat/demo-item', { code: 0 }],
      ['openspec new change', { code: 0 }],
      [
        'openspec instructions proposal',
        {
          stdout: JSON.stringify({
            template: '# Proposal\nfull',
            rules: ['Keep proposals under 400 words'],
          }),
        },
      ],
    ])
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code, r.err).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.ok).toBe(true)
    expect(j.item).toEqual({
      slug: 'demo-item',
      tag: 'prep',
      title: 'Fewer calls',
      file: 'docs/roadmap/M2.1/demo-item.md',
      milestone: 'M2.1 — Q',
      goal: ['goal text'],
      body: '## Scope\n- [ ] a',
    })
    expect(j.skips).toEqual(expect.arrayContaining(['other', 'remote-one']))
    expect(j.instructions).toEqual({
      template: '# Proposal\nfull',
      rules: ['Keep proposals under 400 words'],
    })
    expect(j.touchSet).toBe('TBD until design.md')
    expect(j.branch).toBe('feat/demo-item')
  })

  it('text mode prints exact sections for rules template body', () => {
    const root = tmpRoot()
    const item = {
      slug: 'demo-item',
      tag: 'prep',
      title: 't',
      file: 'f',
      milestone: 'M',
      goal: ['g1', 'g2'],
      body: 'BODY',
    }
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git fetch origin', { code: 0 }],
      ['git switch main', { code: 0 }],
      ['git pull --ff-only', { code: 0 }],
      ['gh pr list', { stdout: '' }],
      ['git branch -r', { stdout: '' }],
      ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
      ['git switch -c feat/demo-item', { code: 0 }],
      ['openspec new change', { code: 0 }],
      [
        'openspec instructions proposal',
        {
          stdout: JSON.stringify({
            template: '# Proposal\nline2',
            rules: ['rule-one', 'rule-two'],
          }),
        },
      ],
    ])
    const r = run(['preflight', '--root', root], { cwd: root, exec, env: {} })
    expect(r.code, r.err).toBe(0)
    expect(r.out).toBe(
      [
        'ok: true',
        'branch: feat/demo-item',
        'slug: demo-item',
        'tag: prep',
        'title: t',
        'file: f',
        'milestone: M',
        'goal: g1',
        'goal: g2',
        'skips: ',
        'touchSet: TBD until design.md',
        '--- rules ---',
        '  1. rule-one',
        '  2. rule-two',
        '--- template ---',
        '# Proposal\nline2',
        '--- body ---',
        'BODY',
      ].join('\n'),
    )
  })

  it('text mode prints (none) for empty rules and string goal', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'demo-item'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(root, 'openspec', 'changes', 'demo-item', 'design.md'),
      '| `AGENTS.md` | nav |\n',
    )
    const item = {
      slug: 'demo-item',
      tag: null,
      title: '',
      file: '',
      goal: 'single-goal',
      body: null,
    }
    const r = run(['preflight', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: '' }],
        ['git branch -r', { stdout: '' }],
        ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
        ['git switch -c feat/demo-item', { code: 1 }],
        ['git branch --show-current', { stdout: 'main\n' }],
        ['git show-ref --verify', { code: 0 }],
        [
          'git merge-base feat/demo-item origin/main',
          { code: 0, stdout: 'a\n' },
        ],
        [
          'git worktree list --porcelain',
          { stdout: `worktree ${root}\nHEAD a\nbranch refs/heads/main\n` },
        ],
        ['git switch feat/demo-item', { code: 0 }],
        [
          'openspec instructions proposal',
          { stdout: JSON.stringify({ template: null, rules: [] }) },
        ],
      ]),
      env: {},
    })
    expect(r.code, r.err).toBe(0)
    expect(r.out).toContain('goal: single-goal')
    expect(r.out).toContain('  (none)')
    expect(r.out).toContain('touchSet: openspec/changes/demo-item/design.md')
    expect(r.out).toContain('--- template ---\nnull')
    expect(r.out).toContain('--- body ---\nnull')
  })

  it('fails on dirty tree with exact message', () => {
    const root = tmpRoot()
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: ' M README.md\n' }],
      ]),
      env: {},
    })
    expect(r.code).toBe(2)
    expect(JSON.parse(r.err).error).toBe('working tree not clean:\nM README.md')
  })

  it('fails when gh pr list fails', () => {
    const root = tmpRoot()
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { code: 1, stderr: 'auth required\n' }],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toBe(
      'gh pr list failed (cannot build skip-list):\nauth required',
    )
  })

  it('fails when git branch -r fails', () => {
    const root = tmpRoot()
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: '' }],
        ['git branch -r', { code: 1, stderr: 'fatal\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toBe('git branch -r failed:\nfatal')
  })

  it('fails when openspec instructions fails', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'demo-item'), {
      recursive: true,
    })
    const item = { slug: 'demo-item', tag: 'prep', title: 't', file: 'f' }
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: '' }],
        ['git branch -r', { stdout: '' }],
        ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
        ['git switch -c feat/demo-item', { code: 0 }],
        [
          'openspec instructions proposal',
          { code: 1, stderr: 'no such artifact\n' },
        ],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toMatch(/^openspec instructions failed/)
    expect(JSON.parse(r.err).error).toContain('no such artifact')
  })

  it('fails when openspec instructions JSON is invalid', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'demo-item'), {
      recursive: true,
    })
    const item = { slug: 'demo-item', tag: 'prep', title: 't', file: 'f' }
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: '' }],
        ['git branch -r', { stdout: '' }],
        ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
        ['git switch -c feat/demo-item', { code: 0 }],
        ['openspec instructions proposal', { stdout: 'not-json{' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toMatch(
      /^openspec instructions returned invalid JSON:/,
    )
  })

  it('fails when rules is not an array', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'demo-item'), {
      recursive: true,
    })
    const item = { slug: 'demo-item', tag: 'prep', title: 't', file: 'f' }
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: '' }],
        ['git branch -r', { stdout: '' }],
        ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
        ['git switch -c feat/demo-item', { code: 0 }],
        [
          'openspec instructions proposal',
          { stdout: JSON.stringify({ template: 'T', rules: null }) },
        ],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toBe(
      'openspec instructions missing rules array',
    )
  })

  it('fails on wrong node major and missing pnpm', () => {
    const root = tmpRoot()
    const r1 = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([['node -v', { stdout: 'v18.0.0\n' }]]),
      env: {},
    })
    expect(JSON.parse(r1.err).error).toBe(
      'node major is 18; need 22 from .nvmrc (source scripts/agent-env.sh)',
    )
    const r2 = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ['node -v', { stdout: 'v22.0.0\n' }],
        ['command -v pnpm', { code: 1 }],
      ]),
      env: {},
    })
    expect(JSON.parse(r2.err).error).toBe(
      'pnpm not on PATH (source scripts/agent-env.sh once)',
    )
    const r3 = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ['node -v', { code: 1, stderr: 'gone\n' }],
        ['command -v pnpm', { code: 0 }],
      ]),
      env: {},
    })
    expect(JSON.parse(r3.err).error).toBe(
      'node major is missing; need 22 from .nvmrc (source scripts/agent-env.sh)',
    )
  })

  it('passes --skip from open PRs remotes and flag', () => {
    const root = tmpRoot()
    const item = { slug: 'keep', tag: 'prep', title: 't', file: 'f' }
    let nextArgs = null
    const r = run(['preflight', '--json', '--root', root, '--skip', 'extra'], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: 'fix/from-pr\n' }],
        ['git branch -r', { stdout: '  origin/fix/from-remote\n' }],
        [
          'pnpm -s roadmap next --json',
          (file, args) => {
            nextArgs = args
            return { stdout: JSON.stringify(item) }
          },
        ],
        ['git switch -c feat/keep', { code: 0 }],
        ['openspec new change', { code: 0 }],
        [
          'openspec instructions proposal',
          { stdout: JSON.stringify({ template: 'T', rules: ['r'] }) },
        ],
      ]),
      env: {},
    })
    expect(r.code, r.err).toBe(0)
    expect(nextArgs).toEqual([
      '-s',
      'roadmap',
      'next',
      '--json',
      '--skip',
      'extra,from-pr,from-remote',
    ])
    expect(JSON.parse(r.out).branch).toBe('feat/keep')
  })

  it('reuses existing local branch when switch -c fails and merge-base ok', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'reuse-item'), {
      recursive: true,
    })
    const item = { slug: 'reuse-item', tag: 'prep', title: 't', file: 'f' }
    const calls = []
    const exec = (file, args) => {
      calls.push([file, [...args]])
      const key = `${file} ${args.join(' ')}`
      if (key.includes('node -v'))
        return { code: 0, stdout: 'v22.0.0\n', stderr: '' }
      if (key.includes('command -v pnpm'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git status --porcelain'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git fetch')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git switch main'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git pull')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr list')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git branch -r'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git branch --format'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git worktree list'))
        return {
          code: 0,
          stdout: `worktree ${root}\nHEAD abc\nbranch refs/heads/main\n`,
          stderr: '',
        }
      if (key.includes('roadmap next'))
        return { code: 0, stdout: JSON.stringify(item), stderr: '' }
      if (key.includes('git switch -c'))
        return { code: 1, stdout: '', stderr: 'already exists\n' }
      if (key.includes('git branch --show-current'))
        return { code: 0, stdout: 'main\n', stderr: '' }
      if (key.includes('git show-ref --verify'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git merge-base feat/reuse-item origin/main'))
        return { code: 0, stdout: 'abc\n', stderr: '' }
      if (key === 'git switch feat/reuse-item')
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('openspec instructions'))
        return {
          code: 0,
          stdout: JSON.stringify({ template: 'T', rules: ['r'] }),
          stderr: '',
        }
      return { code: 1, stdout: '', stderr: `unhandled ${key}` }
    }
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code, r.err).toBe(0)
    expect(calls).toContainEqual(['git', ['switch', '-c', 'feat/reuse-item']])
    expect(calls).toContainEqual(['git', ['switch', 'feat/reuse-item']])
  })

  it('reports error when switch -c fails and branch cannot be reused', () => {
    const root = tmpRoot()
    const item = { slug: 'reuse-item', tag: 'prep', title: 't', file: 'f' }
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: '' }],
        ['git branch -r', { stdout: '' }],
        ['git branch --format', { stdout: '' }],
        ['git worktree list --porcelain', { stdout: '' }],
        ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
        ['git switch -c feat/reuse-item', { code: 1, stderr: 'exists\n' }],
        ['git branch --show-current', { stdout: 'main\n' }],
        ['git show-ref --verify', { code: 1, stderr: 'missing\n' }],
      ]),
      env: {},
    })
    expect(r.code).not.toBe(0)
    expect(JSON.parse(r.err).error).toMatch(
      /cannot create branch feat\/reuse-item/,
    )
    expect(JSON.parse(r.err).error).toContain('exists')
  })

  it('records exact argv for sync skip openspec and branch create', () => {
    const root = tmpRoot()
    const item = {
      slug: 'argv-item',
      tag: 'prep',
      title: 't',
      file: 'f',
      goal: ['g'],
    }
    const calls = []
    const exec = (file, args) => {
      calls.push([file, [...args]])
      const key = `${file} ${args.join(' ')}`
      if (key.includes('node -v'))
        return { code: 0, stdout: 'v22.0.0\n', stderr: '' }
      if (key.includes('command -v pnpm'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git status --porcelain'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git fetch')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git switch main'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git pull')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr list'))
        return { code: 0, stdout: 'feat/skip-me\n', stderr: '' }
      if (key.includes('git branch -r'))
        return {
          code: 0,
          stdout: '  origin/feat/remote-a\n  origin/main\n',
          stderr: '',
        }
      if (key.includes('git branch --format'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git worktree list'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('roadmap next'))
        return { code: 0, stdout: JSON.stringify(item), stderr: '' }
      if (key.includes('git switch -c'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('openspec new'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('openspec instructions'))
        return {
          code: 0,
          stdout: JSON.stringify({ template: 'T', rules: ['r'] }),
          stderr: '',
        }
      return { code: 1, stdout: '', stderr: `unhandled ${key}` }
    }
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code, r.err).toBe(0)
    expect(calls).toContainEqual(['git', ['fetch', 'origin']])
    expect(calls).toContainEqual(['git', ['switch', 'main']])
    expect(calls).toContainEqual(['git', ['pull', '--ff-only']])
    expect(calls).toContainEqual([
      'gh',
      [
        'pr',
        'list',
        '--state',
        'open',
        '--json',
        'headRefName',
        '-q',
        '.[].headRefName',
      ],
    ])
    expect(calls).toContainEqual(['git', ['branch', '-r']])
    expect(calls).toContainEqual([
      'pnpm',
      ['-s', 'roadmap', 'next', '--json', '--skip', 'skip-me,remote-a'],
    ])
    expect(calls).toContainEqual(['git', ['switch', '-c', 'feat/argv-item']])
    expect(calls).toContainEqual(['openspec', ['new', 'change', 'argv-item']])
    expect(calls).toContainEqual([
      'openspec',
      ['instructions', 'proposal', '--change', 'argv-item', '--json'],
    ])
    expect(JSON.parse(r.out).skips).toEqual(['skip-me', 'remote-a'])
  })

  it('preflight --slug branches from origin/main without switching main', () => {
    const root = tmpRoot()
    const item = {
      slug: 'slug-item',
      tag: 'prep',
      title: 't',
      file: 'f',
      milestone: 'M2.1',
      goal: ['g'],
    }
    const calls = []
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git fetch origin', { code: 0 }],
      ['gh pr list', { stdout: '' }],
      ['git branch -r', { stdout: '' }],
      [
        'pnpm -s roadmap next --json --slug slug-item',
        { stdout: JSON.stringify(item) },
      ],
      ['git switch -c feat/slug-item --no-track origin/main', { code: 0 }],
      ['openspec new change', { code: 0 }],
      [
        'openspec instructions proposal',
        { stdout: JSON.stringify({ template: 'T', rules: ['r'] }) },
      ],
    ])
    const wrapped = (file, args, opts) => {
      calls.push([file, [...args]])
      return exec(file, args, opts)
    }
    const r = run(
      ['preflight', '--slug', 'slug-item', '--json', '--root', root],
      {
        cwd: root,
        exec: wrapped,
        env: {},
      },
    )
    expect(r.code, r.err).toBe(0)
    expect(
      calls.some(
        (c) => c[0] === 'git' && c[1][0] === 'switch' && c[1][1] === 'main',
      ),
    ).toBe(false)
    expect(calls).toContainEqual([
      'git',
      ['switch', '-c', 'feat/slug-item', '--no-track', 'origin/main'],
    ])
    expect(JSON.parse(r.out).item.slug).toBe('slug-item')
  })
})

describe('finish', () => {
  function finishBase(extra = []) {
    return fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['git rev-list --count origin/main..HEAD', { stdout: '2\n' }],
      ['pnpm verify:fast:quiet', { code: 0 }],
      ...extra,
    ])
  }

  it('refuses dirty tree', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '?? x\n' }],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toBe(
      'working tree not clean (commit first):\n?? x',
    )
  })

  it('refuses main', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'main\n' }],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toBe(
      'finish refuses branch "main" (need feat/* or fix/* with commits ahead of origin/main)',
    )
  })

  it('refuses zero commits ahead', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: '0\n' }],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toBe(
      'finish refuses: no commits ahead of origin/main (ahead=0)',
    )
  })

  it('refuses NaN ahead count', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: 'NaN\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toBe(
      'finish refuses: no commits ahead of origin/main (ahead=NaN)',
    )
  })

  it('refuses empty ahead stdout using 0 fallback in message', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: '  \n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toBe(
      'finish refuses: no commits ahead of origin/main (ahead=0)',
    )
  })

  it('text mode push failure omits checks lines', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: '2\n' }],
        ['pnpm verify:fast:quiet', { code: 0 }],
        ['git push', { code: 1, stderr: 'denied\n' }],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(r.out).toBe(
      [
        'ok: false',
        'stage: push',
        'pushAttempts: 1',
        'branch: feat/demo',
        'ahead: 2',
        'pr: undefined',
        'summary: denied',
        '--- log-failed (tail) ---',
        'undefined',
      ].join('\n'),
    )
  })

  it('verify failure includes real error tail', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
        [
          'pnpm verify:fast:quiet',
          {
            code: 1,
            stdout: 'ELIFECYCLE Command failed.\n',
            stderr: 'Error: expected 1 to be 2\n at foo.test.ts:10\n',
          },
        ],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toContain('expected 1 to be 2')
  })

  it('one push per call and persists budget', () => {
    const root = tmpRoot(true)
    let pushes = 0
    const pushFail = () => {
      pushes++
      return { code: 1, stderr: 'pre-push failed\n' }
    }
    const r1 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([['git push', pushFail]]),
      env: {},
    })
    expect(r1.code).toBe(1)
    expect(JSON.parse(r1.out)).toMatchObject({
      ok: false,
      stage: 'push',
      pushAttempts: 1,
      branch: 'feat/demo',
      ahead: 2,
      summary: 'pre-push failed',
    })
    expect(pushes).toBe(1)

    const r2 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([['git push', pushFail]]),
      env: {},
    })
    expect(JSON.parse(r2.out).pushAttempts).toBe(2)
    expect(pushes).toBe(2)

    const r3 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([
        [
          'git push',
          () => {
            throw new Error('should not push when budget exhausted')
          },
        ],
      ]),
      env: {},
    })
    expect(JSON.parse(r3.out).summary).toBe(
      'push budget exhausted for feat/demo (2 failed attempts recorded under .git/agent-finish-push-failures.json)',
    )
    expect(pushes).toBe(2)
  })

  it('happy path treats skipping as pass', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, '## Summary\n')
    const r = run(
      [
        'finish',
        '--json',
        '--quiet',
        '--root',
        root,
        '--title',
        't',
        '--body-file',
        body,
      ],
      {
        cwd: root,
        exec: finishBase([
          ['git push', { code: 0 }],
          ['gh pr list --head', { stdout: 'null\n' }],
          [
            'gh pr create',
            { stdout: '\u001b[32mhttps://example.com/pr/1\u001b[0m\n' },
          ],
          ['gh pr checks --watch', { code: 0 }],
          [
            'gh pr checks --json',
            {
              stdout: JSON.stringify([
                { name: 'a', bucket: 'pass', link: '' },
                { name: 'b', bucket: 'skipping', link: '' },
              ]),
            },
          ],
        ]),
        env: { CI: '1' },
      },
    )
    expect(r.code, r.err).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.ok).toBe(true)
    expect(j.prUrl).toBe('https://example.com/pr/1')
    expect(j.created).toBe(true)
    expect(j.checks).toEqual(['a: pass', 'b: skipping'])
  })

  it('fetches log-failed with run id from check link', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'x\n')
    let viewed = null
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      {
        cwd: root,
        exec: finishBase([
          ['git push', { code: 0 }],
          [
            'gh pr list --head',
            { stdout: JSON.stringify({ number: 1, url: 'https://pr/1' }) },
          ],
          ['gh pr checks --watch', { code: 0 }],
          [
            'gh pr checks --json',
            {
              stdout: JSON.stringify([
                {
                  name: 'checks',
                  bucket: 'fail',
                  link: 'https://github.com/o/r/actions/runs/999/job/1',
                },
              ]),
            },
          ],
          [
            'gh run view',
            (file, args) => {
              viewed = args
              return { code: 0, stdout: 'job failed detail\n'.repeat(5) }
            },
          ],
        ]),
        env: {},
      },
    )
    expect(r.code).toBe(1)
    expect(viewed).toEqual(['run', 'view', '999', '--log-failed'])
    expect(JSON.parse(r.out).logTail).toContain('job failed detail')
    expect(JSON.parse(r.out).created).toBe(false)
  })

  it('reports when failed check has no actions link', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--root', root], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        [
          'gh pr list --head',
          { stdout: JSON.stringify({ number: 1, url: 'https://pr/1' }) },
        ],
        ['gh pr checks --watch', { code: 0 }],
        [
          'gh pr checks --json',
          {
            stdout: JSON.stringify([
              { name: 'x', bucket: 'fail', link: 'https://example.com/nope' },
            ]),
          },
        ],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(r.out).toContain(
      'failed check has no actions/runs link; cannot fetch --log-failed',
    )
    expect(r.out).toContain('ok: false')
    expect(r.out).toContain('stage: ci')
    expect(r.out).toContain('pr: https://pr/1')
    expect(r.out).toContain('--- log-failed (tail) ---')
  })

  it('reports checks query failure', () => {
    const root = tmpRoot(true)
    writePushFailures(root, { 'feat/demo': 1 })
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        [
          'gh pr list --head',
          { stdout: JSON.stringify({ number: 9, url: 'https://pr/9' }) },
        ],
        ['gh pr checks --watch', { code: 0 }],
        ['gh pr checks --json', { code: 1, stderr: 'rate limit\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.out).summary).toBe(
      'gh pr checks query failed:\nrate limit',
    )
    expect(readPushFailures(root)['feat/demo']).toBeUndefined()
  })

  it('reports invalid checks JSON', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        [
          'gh pr list --head',
          { stdout: JSON.stringify({ number: 9, url: 'https://pr/9' }) },
        ],
        ['gh pr checks --watch', { code: 0 }],
        ['gh pr checks --json', { stdout: '{not-array}' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.out).summary).toMatch(/invalid JSON/)
  })

  it('treats non-array checks JSON as empty failure', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--root', root], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        [
          'gh pr list --head',
          { stdout: JSON.stringify({ number: 1, url: 'https://pr/1' }) },
        ],
        ['gh pr checks --watch', { code: 0 }],
        ['gh pr checks --json', { stdout: '{"nope":true}' }],
      ]),
      env: {},
    })
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/ok: false/)
  })

  it('requires --title when creating PR', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        ['gh pr list --head', { stdout: 'null\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toBe('finish create needs --title')
  })

  it('requires --body-file when creating PR', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root, '--title', 't'], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        ['gh pr list --head', { stdout: 'null\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toBe('finish create needs --body-file')
  })

  it('fails when body file is missing', () => {
    const root = tmpRoot(true)
    const missing = path.resolve(root, 'missing.md')
    const r = run(
      [
        'finish',
        '--json',
        '--root',
        root,
        '--title',
        't',
        '--body-file',
        'missing.md',
      ],
      {
        cwd: root,
        exec: finishBase([
          ['git push', { code: 0 }],
          ['gh pr list --head', { stdout: 'null\n' }],
        ]),
        env: {},
      },
    )
    expect(JSON.parse(r.err).error).toBe(`body file missing: ${missing}`)
  })

  it('ignores unparseable existing PR list stdout', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      {
        cwd: root,
        exec: finishBase([
          ['git push', { code: 0 }],
          ['gh pr list --head', { stdout: 'not-json{' }],
          ['gh pr create', { stdout: 'https://example.com/pr/2\n' }],
          ['gh pr checks --watch', { code: 0 }],
          [
            'gh pr checks --json',
            {
              stdout: JSON.stringify([{ name: 'a', bucket: 'pass' }]),
            },
          ],
        ]),
        env: {},
      },
    )
    expect(r.code, r.err).toBe(0)
    expect(JSON.parse(r.out).created).toBe(true)
    expect(JSON.parse(r.out).prUrl).toBe('https://example.com/pr/2')
  })

  it('creates PR when gh pr list --head fails', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    let created = false
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      {
        cwd: root,
        exec: finishBase([
          ['git push', { code: 0 }],
          ['gh pr list --head', { code: 1, stderr: 'err\n' }],
          [
            'gh pr create',
            () => {
              created = true
              return { stdout: 'https://example.com/pr/3\n' }
            },
          ],
          ['gh pr checks --watch', { code: 0 }],
          [
            'gh pr checks --json',
            {
              stdout: JSON.stringify([{ name: 'a', bucket: 'pass' }]),
            },
          ],
        ]),
        env: {},
      },
    )
    expect(created).toBe(true)
    expect(JSON.parse(r.out).prUrl).toBe('https://example.com/pr/3')
  })

  it('creates PR when existing list stdout is empty', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      {
        cwd: root,
        exec: finishBase([
          ['git push', { code: 0 }],
          ['gh pr list --head', { stdout: '' }],
          ['gh pr create', { stdout: 'https://example.com/pr/4\n' }],
          ['gh pr checks --watch', { code: 0 }],
          [
            'gh pr checks --json',
            {
              stdout: JSON.stringify([{ name: 'a', bucket: 'skip' }]),
            },
          ],
        ]),
        env: {},
      },
    )
    expect(JSON.parse(r.out).ok).toBe(true)
    expect(JSON.parse(r.out).created).toBe(true)
  })

  it('ok is false when checks list is empty array', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        [
          'gh pr list --head',
          { stdout: JSON.stringify({ number: 1, url: 'https://pr/1' }) },
        ],
        ['gh pr checks --watch', { code: 0 }],
        ['gh pr checks --json', { stdout: '[]' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.out).ok).toBe(false)
    expect(JSON.parse(r.out).checks).toEqual([])
  })

  it('pending bucket keeps ok false without log-failed fetch', () => {
    const root = tmpRoot(true)
    let viewed = false
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: finishBase([
        ['git push', { code: 0 }],
        [
          'gh pr list --head',
          { stdout: JSON.stringify({ number: 1, url: 'https://pr/1' }) },
        ],
        ['gh pr checks --watch', { code: 0 }],
        [
          'gh pr checks --json',
          {
            stdout: JSON.stringify([
              { name: 'x', bucket: 'pending', link: '' },
            ]),
          },
        ],
        [
          'gh run view',
          () => {
            viewed = true
            return { code: 0, stdout: 'nope' }
          },
        ],
      ]),
      env: {},
    })
    expect(JSON.parse(r.out).ok).toBe(false)
    expect(JSON.parse(r.out).logTail).toBe(null)
    expect(viewed).toBe(false)
  })

  it('CI env alone enables quiet stripping', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      {
        cwd: root,
        exec: finishBase([
          ['git push', { code: 0 }],
          ['gh pr list --head', { stdout: 'null\n' }],
          [
            'gh pr create',
            { stdout: '\u001b[32mhttps://example.com/pr/ci\u001b[0m\n' },
          ],
          ['gh pr checks --watch', { code: 0 }],
          [
            'gh pr checks --json',
            {
              stdout: JSON.stringify([{ name: 'a', bucket: 'pass' }]),
            },
          ],
        ]),
        env: { CI: 'true' },
      },
    )
    expect(JSON.parse(r.out).prUrl).toBe('https://example.com/pr/ci')
  })

  it('records exact argv for push create and checks watch', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'body-text\n')
    const calls = []
    const exec = (file, args) => {
      calls.push([file, [...args]])
      const key = `${file} ${args.join(' ')}`
      if (key.includes('node -v'))
        return { code: 0, stdout: 'v22.0.0\n', stderr: '' }
      if (key.includes('command -v pnpm'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git status --porcelain'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git branch --show-current'))
        return { code: 0, stdout: 'feat/demo\n', stderr: '' }
      if (key.includes('git rev-list'))
        return { code: 0, stdout: '3\n', stderr: '' }
      if (key.includes('verify:fast:quiet'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git fetch')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git merge-base --is-ancestor'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git rev-parse --git-path'))
        return {
          code: 0,
          stdout: `.git/agent-finish-push-failures.json\n`,
          stderr: '',
        }
      if (key.includes('git push')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr list'))
        return { code: 0, stdout: 'null\n', stderr: '' }
      if (key.includes('gh pr create'))
        return { code: 0, stdout: 'https://example.com/pr/5\n', stderr: '' }
      if (key.includes('gh pr checks --watch'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr checks --json'))
        return {
          code: 0,
          stdout: JSON.stringify([{ name: 'a', bucket: 'pass', link: '' }]),
          stderr: '',
        }
      return { code: 1, stdout: '', stderr: `unhandled ${key}` }
    }
    const r = run(
      [
        'finish',
        '--json',
        '--root',
        root,
        '--title',
        'My Title',
        '--body-file',
        body,
      ],
      { cwd: root, exec, env: {} },
    )
    expect(r.code, r.err).toBe(0)
    expect(calls).toContainEqual([
      'git',
      ['push', '-q', '-u', 'origin', 'HEAD'],
    ])
    expect(calls).toContainEqual([
      'gh',
      [
        'pr',
        'list',
        '--head',
        'feat/demo',
        '--json',
        'number,url',
        '-q',
        '.[0]',
      ],
    ])
    expect(calls).toContainEqual([
      'gh',
      ['pr', 'create', '--title', 'My Title', '--body-file', body],
    ])
    expect(calls).toContainEqual([
      'gh',
      ['pr', 'checks', '--watch', '--fail-fast', '--interval', '30'],
    ])
    expect(calls).toContainEqual([
      'gh',
      ['pr', 'checks', '--json', 'name,bucket,link'],
    ])
    expect(calls).toContainEqual([
      'git',
      ['rev-list', '--count', 'origin/main..HEAD'],
    ])
  })
})

describe('review-brief', () => {
  it('includes untracked touch-set file and outsideTouchSet diff', () => {
    const repo = gitInitRepo()
    const change = path.join(repo, 'openspec', 'changes', 'demo')
    fs.mkdirSync(change, { recursive: true })
    fs.writeFileSync(
      path.join(change, 'design.md'),
      `# Design\n\n## Touch-set\n\n| File | Why |\n| ---- | --- |\n| \`scripts/agent.mjs\` | cli |\n| \`in-touch.txt\` | tracked |\n`,
    )
    fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true })
    fs.writeFileSync(
      path.join(repo, 'scripts', 'agent.mjs'),
      'export const x=1\n',
    )
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'changed\n')
    fs.writeFileSync(path.join(repo, 'outside.txt'), 'out\n')

    const r = run(
      [
        'review-brief',
        '--json',
        '--root',
        repo,
        '--change',
        'demo',
        '--rules-json',
        '["r"]',
      ],
      { cwd: repo, env: {} },
    )
    expect(r.code, r.err).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.base).toBe('HEAD')
    expect(j.mergeBase).toMatch(/^[0-9a-f]{40}$/)
    expect(j.headDiff).toBeUndefined()
    expect(j.untracked).toEqual(
      expect.arrayContaining(['scripts/agent.mjs', 'outside.txt']),
    )
    expect(j.touchDiff).toMatch(/agent\.mjs/)
    expect(j.inTouchSet).toEqual(['scripts/agent.mjs'])
    expect(j.outsideTouchSet).toEqual(
      expect.arrayContaining(['tracked.txt', 'outside.txt']),
    )
    expect(j.inTouchSet.every((f) => !j.outsideTouchSet.includes(f))).toBe(true)
    expect(j.outsideDiff).toMatch(/tracked\.txt/)
    expect(j.outsideDiff).toMatch(/changed/)
    expect(j.outsideDiff).toMatch(/outside\.txt/)
    expect(j.diffStat).toMatch(/\?\?/)
    expect(j.rules).toEqual(['r'])
    expect(j.rulesNote).toBe(null)
  })

  it('uses --base merge-base for committed diffs on a clean tree', () => {
    const repo = gitInitRepo()
    const change = path.join(repo, 'openspec', 'changes', 'demo')
    fs.mkdirSync(change, { recursive: true })
    fs.writeFileSync(
      path.join(change, 'design.md'),
      `| File | Why |\n| ---- | --- |\n| \`tracked.txt\` | t |\n`,
    )
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'committed-change\n')
    execFileSync('git', ['add', 'tracked.txt', 'openspec'], {
      cwd: repo,
      stdio: 'ignore',
    })
    execFileSync('git', ['commit', '-m', 'change'], {
      cwd: repo,
      stdio: 'ignore',
    })
    const headEmpty = run(
      ['review-brief', '--json', '--change', 'demo', '--root', repo],
      { cwd: repo, env: {} },
    )
    expect(JSON.parse(headEmpty.out).touchDiff).toBe('(empty)')

    const withBase = run(
      [
        'review-brief',
        '--json',
        '--change',
        'demo',
        '--root',
        repo,
        '--base',
        'HEAD~1',
      ],
      { cwd: repo, env: {} },
    )
    expect(withBase.code, withBase.err).toBe(0)
    const j = JSON.parse(withBase.out)
    expect(j.base).toBe('HEAD~1')
    expect(j.mergeBase).toMatch(/^[0-9a-f]{40}$/)
    expect(j.touchDiff).toMatch(/committed-change/)
    expect(j.inTouchSet).toEqual(['tracked.txt'])
    expect(j.outsideTouchSet).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/openspec\/changes\/demo\/design\.md/),
      ]),
    )
  })

  it('rejects --base that starts with a dash', () => {
    const repo = gitInitRepo()
    const r = run(
      [
        'review-brief',
        '--json',
        '--change',
        'demo',
        '--root',
        repo,
        '--base',
        '-x',
      ],
      { cwd: repo, env: {} },
    )
    expect(r.code).not.toBe(0)
    expect(JSON.parse(r.err).error).toBe(
      `--base must not start with '-' (got "-x")`,
    )
  })

  it('rejects a bad --base ref', () => {
    const repo = gitInitRepo()
    const r = run(
      [
        'review-brief',
        '--json',
        '--change',
        'demo',
        '--root',
        repo,
        '--base',
        'origin/mian',
      ],
      { cwd: repo, env: {} },
    )
    expect(r.code).not.toBe(0)
    expect(JSON.parse(r.err).error).toMatch(/git merge-base failed/)
  })

  it('fails when merge-base returns empty stdout', () => {
    const root = tmpRoot(true)
    const r = run(
      ['review-brief', '--json', '--change', 'demo', '--root', root],
      {
        cwd: root,
        exec: fakeExec([['git merge-base', { stdout: '  \n' }]]),
        env: {},
      },
    )
    expect(r.code).not.toBe(0)
    expect(JSON.parse(r.err).error).toBe('git merge-base produced empty output')
  })

  it('diff vs merge-base ignores commits that landed only on base', () => {
    const repo = gitInitRepo()
    execFileSync('git', ['branch', '-M', 'main'], {
      cwd: repo,
      stdio: 'ignore',
    })
    execFileSync('git', ['checkout', '-b', 'feat/demo'], {
      cwd: repo,
      stdio: 'ignore',
    })
    fs.writeFileSync(path.join(repo, 'branch-only.txt'), 'on-branch\n')
    execFileSync('git', ['add', 'branch-only.txt'], {
      cwd: repo,
      stdio: 'ignore',
    })
    execFileSync('git', ['commit', '-m', 'branch change'], {
      cwd: repo,
      stdio: 'ignore',
    })

    execFileSync('git', ['checkout', 'main'], { cwd: repo, stdio: 'ignore' })
    fs.writeFileSync(path.join(repo, 'main-only.txt'), 'on-main\n')
    execFileSync('git', ['add', 'main-only.txt'], {
      cwd: repo,
      stdio: 'ignore',
    })
    execFileSync('git', ['commit', '-m', 'main moved'], {
      cwd: repo,
      stdio: 'ignore',
    })

    execFileSync('git', ['checkout', 'feat/demo'], {
      cwd: repo,
      stdio: 'ignore',
    })
    const change = path.join(repo, 'openspec', 'changes', 'demo')
    fs.mkdirSync(change, { recursive: true })
    fs.writeFileSync(
      path.join(change, 'design.md'),
      `| File | Why |\n| ---- | --- |\n| \`branch-only.txt\` | ours |\n`,
    )

    const tip = run(
      [
        'review-brief',
        '--json',
        '--change',
        'demo',
        '--root',
        repo,
        '--base',
        'main',
      ],
      { cwd: repo, env: {} },
    )
    expect(tip.code, tip.err).toBe(0)
    const j = JSON.parse(tip.out)
    expect(j.inTouchSet).toEqual(['branch-only.txt'])
    expect(j.outsideTouchSet).not.toContain('main-only.txt')
    expect(j.diffStat).not.toMatch(/main-only/)
    expect(j.touchDiff).toMatch(/on-branch/)
  })

  it('rejects invalid --rules-json', () => {
    const root = tmpRoot(true)
    const brief = run(
      ['review-brief', '--json', '--root', root, '--rules-json', '{'],
      {
        cwd: root,
        exec: fakeExec([['git branch --show-current', { stdout: 'feat/z\n' }]]),
        env: {},
      },
    )
    expect(JSON.parse(brief.err).error).toBe('--rules-json must be valid JSON')
  })

  it('notes missing design.md and empty rules', () => {
    const repo = gitInitRepo()
    const b2 = run(['review-brief', '--change', 'missing', '--root', repo], {
      cwd: repo,
      env: {},
    })
    expect(b2.code).toBe(0)
    expect(b2.out).toMatch(
      /^slug: missing\nchangePath: openspec\/changes\/missing\nbase: HEAD\nmergeBase: [0-9a-f]{40}\nrules: \[\]\nrulesNote: pass --rules-json from openspec instructions\n--- diff --stat ---\n/,
    )
    expect(b2.out).toContain(
      'design.md missing; treating all paths as outside touch-set',
    )
    expect(b2.out).toContain('\n--- touch-set diff ---\n(empty)\n')
    expect(b2.out).toContain('\n--- outsideTouchSet ---\n')
    expect(b2.out).toContain('\n--- outsideTouchSet diff ---\n')
  })

  it('lists only-untracked outside with empty touchDiff', () => {
    const repo = gitInitRepo()
    const change = path.join(repo, 'openspec', 'changes', 'demo')
    fs.mkdirSync(change, { recursive: true })
    fs.writeFileSync(
      path.join(change, 'design.md'),
      `| File | Why |\n| ---- | --- |\n| \`does-not-exist-yet.txt\` | future |\n`,
    )
    fs.writeFileSync(path.join(repo, 'only-out.txt'), 'x\n')
    const r = run(
      ['review-brief', '--json', '--change', 'demo', '--root', repo],
      { cwd: repo, env: {} },
    )
    expect(r.code).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.outsideTouchSet).toContain('only-out.txt')
    expect(j.touchDiff).toBe('(empty)')
    expect(j.outsideDiff).toMatch(/only-out\.txt/)
  })

  it('records exact git merge-base and diff argv for --base', () => {
    const root = tmpRoot(true)
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'demo'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(root, 'openspec', 'changes', 'demo', 'design.md'),
      `| File | Why |\n| ---- | --- |\n| \`a.txt\` | t |\n`,
    )
    const mb = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const calls = []
    const exec = (file, args) => {
      calls.push([file, [...args]])
      const key = `${file} ${args.join(' ')}`
      if (key.includes('git merge-base'))
        return { code: 0, stdout: `${mb}\n`, stderr: '' }
      if (key.includes('git diff') && key.includes('--stat'))
        return { code: 0, stdout: ' 1 file changed\n', stderr: '' }
      if (key.includes('git ls-files'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git diff') && key.includes('--name-only'))
        return { code: 0, stdout: 'a.txt\n', stderr: '' }
      if (key.includes('git diff') && key.includes('-- a.txt'))
        return { code: 0, stdout: 'diff --git a/a.txt\n+hi\n', stderr: '' }
      return { code: 0, stdout: '', stderr: '' }
    }
    const r = run(
      [
        'review-brief',
        '--json',
        '--root',
        root,
        '--change',
        'demo',
        '--base',
        'origin/main',
        '--rules-json',
        '[]',
      ],
      { cwd: root, exec, env: {} },
    )
    expect(r.code, r.err).toBe(0)
    expect(calls).toContainEqual(['git', ['merge-base', 'origin/main', 'HEAD']])
    expect(calls).toContainEqual(['git', ['diff', mb, '--stat']])
    expect(calls).toContainEqual(['git', ['diff', mb, '--name-only']])
    expect(calls).toContainEqual(['git', ['diff', mb, '--', 'a.txt']])
    expect(calls).toContainEqual([
      'git',
      ['ls-files', '--others', '--exclude-standard'],
    ])
    expect(JSON.parse(r.out).mergeBase).toBe(mb)
    expect(JSON.parse(r.out).touchDiff).toContain('+hi')
  })

  it('fails when --no-index exits outside 0/1', () => {
    expect(() =>
      mustOkDiffNoIndex(
        { code: 2, stdout: '', stderr: 'fatal\n' },
        'git diff --no-index x',
      ),
    ).toThrow(/git diff --no-index x failed \(exit 2\)/)
    expect(
      mustOkDiffNoIndex({ code: 1, stdout: 'diff\n', stderr: '' }, 'ok'),
    ).toEqual({ code: 1, stdout: 'diff\n', stderr: '' })
  })
})

describe('help / errors / defaultExec / main', () => {
  it('help output contains usage contract', () => {
    const h = run(['help'])
    expect(h.code).toBe(0)
    for (const s of HELP_SNIPPETS) expect(h.out).toContain(s)
    expect(run(['--help']).code).toBe(0)
    expect(run([]).code).toBe(2)
    expect(run([]).out).toContain('usage: pnpm agent')
  })

  it('unknown command includes HELP', () => {
    const u = run(['nope', '--json'])
    expect(u.code).toBe(2)
    const err = JSON.parse(u.err).error
    expect(err.startsWith('unknown command: nope\n')).toBe(true)
    expect(err).toContain('usage: pnpm agent')
  })

  it('rejects unexpected positional args', () => {
    const extra = run(['preflight', 'extra', '--json'])
    expect(extra.code).toBe(2)
    expect(JSON.parse(extra.err).error).toBe('unexpected argument: extra')
  })

  it('defaultExec success exit and signal paths', () => {
    const ok = defaultExec('node', ['-e', 'process.stdout.write("hi")'])
    expect(ok).toEqual({ code: 0, stdout: 'hi', stderr: '' })
    const bad = defaultExec('node', ['-e', 'process.exit(3)'])
    expect(bad.code).toBe(3)
    const withErr = defaultExec('node', [
      '-e',
      'process.stderr.write("e"); process.exit(2)',
    ])
    expect(withErr).toEqual({ code: 2, stdout: '', stderr: 'e' })
    const signaled = defaultExec('node', [
      '-e',
      'process.kill(process.pid,"SIGTERM")',
    ])
    expect(signaled.code).toBe(1)
  })

  it('defaultExec surfaces spawn ENOENT via message fallback', () => {
    const missing = defaultExec('definitely-not-a-binary-photobooks-xyz', [
      '--help',
    ])
    expect(missing.code).toBe(1)
    expect(missing.stdout).toBe('')
    expect(missing.stderr).toMatch(/ENOENT|not found|spawn/i)
    expect(missing.stderr).not.toBe('null')
  })

  it('main writes stdout stderr with trailing newlines', () => {
    const io = {
      stdout: {
        buf: '',
        write(s) {
          this.buf += s
        },
      },
      stderr: {
        buf: '',
        write(s) {
          this.buf += s
        },
      },
      exitCode: 0,
    }
    main(['help'], io)
    expect(io.stdout.buf.endsWith('\n')).toBe(true)
    expect(io.stdout.buf.slice(0, -1)).toContain('usage: pnpm agent')
    expect(io.stderr.buf).toBe('')
    expect(io.exitCode).toBe(0)

    io.stdout.buf = ''
    io.stderr.buf = ''
    main(['nope'], io)
    expect(io.stdout.buf).toBe('')
    expect(io.stderr.buf.endsWith('\n')).toBe(true)
    expect(io.stderr.buf.startsWith('error: unknown command: nope\n')).toBe(
      true,
    )
    expect(io.exitCode).toBe(2)
  })

  it('cli entry via agent-cli.mjs runs help', () => {
    const spawned = execFileSync(
      process.execPath,
      [path.join(here, 'agent-cli.mjs'), 'help'],
      { encoding: 'utf8' },
    )
    expect(spawned).toContain('usage: pnpm agent')
  })

  it('parse failures before o is set still return text errors', () => {
    const r = run(['--nope'])
    expect(r.code).toBe(2)
    expect(r.err).toBe('error: unknown option --nope')
    expect(r.out).toBeUndefined()
  })

  it('quiet strips ansi while non-quiet keeps it on PR URL', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, '## Summary\n')
    const ansiUrl = '\u001b[32mhttps://example.com/pr/9\u001b[0m\n'
    const handlers = [
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
      ['pnpm verify:fast:quiet', { code: 0 }],
      ['git push', { code: 0 }],
      ['gh pr list --head', { stdout: 'null\n' }],
      ['gh pr create', { stdout: ansiUrl }],
      ['gh pr checks --watch', { code: 0 }],
      [
        'gh pr checks --json',
        {
          stdout: JSON.stringify([{ name: 'a', bucket: 'pass', link: '' }]),
        },
      ],
    ]
    const quiet = run(
      [
        'finish',
        '--json',
        '--quiet',
        '--root',
        root,
        '--title',
        't',
        '--body-file',
        body,
      ],
      { cwd: root, exec: fakeExec(handlers), env: {} },
    )
    expect(JSON.parse(quiet.out).prUrl).toBe('https://example.com/pr/9')

    const loud = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      { cwd: root, exec: fakeExec(handlers), env: {} },
    )
    expect(JSON.parse(loud.out).prUrl).toContain('\u001b[32m')
  })

  it('rethrows non-AgentError', () => {
    const root = tmpRoot()
    expect(() =>
      run(['preflight', '--root', root], {
        cwd: root,
        exec: () => {
          throw new TypeError('boom')
        },
        env: {},
      }),
    ).toThrow(TypeError)
  })
})

describe('claimed set and merge helpers', () => {
  it('collectSkipSlugs includes local and worktree feat/fix branches', () => {
    const exec = fakeExec([
      ['gh pr list', { stdout: '' }],
      ['git branch -r', { stdout: '' }],
      [
        'git branch --format',
        { stdout: 'main\nfeat/local-only\nfix/local-fix\n' },
      ],
      [
        'git worktree list --porcelain',
        {
          stdout:
            'worktree /tmp/a\nHEAD abc\nbranch refs/heads/feat/wt-held\n\nworktree /tmp/b\nHEAD def\nbranch refs/heads/main\n',
        },
      ],
    ])
    const skips = collectSkipSlugs(exec, '/tmp', {}, true, 'extra-slug')
    expect(skips).toEqual(
      expect.arrayContaining([
        'extra-slug',
        'local-only',
        'local-fix',
        'wt-held',
      ]),
    )
  })

  it('collectSkipSlugs fails when local branch or worktree list fails', () => {
    expect(() =>
      collectSkipSlugs(
        fakeExec([
          ['gh pr list', { stdout: '' }],
          ['git branch -r', { stdout: '' }],
          ['git branch --format', { code: 1, stderr: 'nope\n' }],
        ]),
        '/tmp',
        {},
        true,
        '',
      ),
    ).toThrow(/git branch failed/)
    expect(() =>
      collectSkipSlugs(
        fakeExec([
          ['gh pr list', { stdout: '' }],
          ['git branch -r', { stdout: '' }],
          ['git branch --format', { stdout: '' }],
          ['git worktree list --porcelain', { code: 1, stderr: 'wt fail\n' }],
        ]),
        '/tmp',
        {},
        true,
        '',
      ),
    ).toThrow(/git worktree list failed/)
  })

  it('resolvePureAddIndexConflict keeps both added index lines; modified lines refuse', () => {
    const base = 'header\nline z\n'
    const ours = 'header\n- [ ] [prep] [one](roadmap/M/one.md) — one\nline z\n'
    const theirs =
      'header\n- [ ] [prep] [two](roadmap/M/two.md) — two\nline z\n'
    const resolved = resolvePureAddIndexConflict(base, ours, theirs)
    expect(resolved).toContain('one.md')
    expect(resolved).toContain('two.md')
    expect(resolved).toMatch(/^header\n/)
    expect(resolved).toMatch(/line z\n$/)
    expect(
      resolvePureAddIndexConflict(
        '- [ ] [prep] [one](roadmap/M/one.md) — old\n',
        '- [x] [prep] [one](roadmap/M/one.md) — old\n',
        '- [ ] [prep] [one](roadmap/M/one.md) — reworded\n',
      ),
    ).toBeNull()
  })

  it('tryResolveTrivialConflicts auto-resolves pure-add index; refuses item files and modified lines', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
    const base = 'header\nline z\n'
    const ours = 'header\n- [ ] [prep] [one](roadmap/M/one.md) — one\nline z\n'
    const theirs =
      'header\n- [ ] [prep] [two](roadmap/M/two.md) — two\nline z\n'
    const execOk = fakeExec([
      ['git show :1:docs/roadmap.md', { stdout: base }],
      ['git show :2:docs/roadmap.md', { stdout: ours }],
      ['git show :3:docs/roadmap.md', { stdout: theirs }],
    ])
    expect(tryResolveTrivialConflicts(root, ['docs/roadmap.md'], execOk)).toBe(
      true,
    )
    const out = fs.readFileSync(path.join(root, 'docs/roadmap.md'), 'utf8')
    expect(out).toContain('one.md')
    expect(out).toContain('two.md')

    expect(tryResolveTrivialConflicts(root, ['src/app.ts'], execOk)).toBe(false)
    expect(
      tryResolveTrivialConflicts(root, ['docs/roadmap/M2.1/item.md'], execOk),
    ).toBe(false)
    expect(
      tryResolveTrivialConflicts(root, ['docs/lessons/01-x.md'], execOk),
    ).toBe(false)
    expect(
      tryResolveTrivialConflicts(
        root,
        ['pnpm-lock.yaml', 'package.json'],
        execOk,
      ),
    ).toBe(false)

    const execMod = fakeExec([
      [
        'git show :1:docs/roadmap.md',
        { stdout: '- [ ] [prep] [one](roadmap/M/one.md) — old\n' },
      ],
      [
        'git show :2:docs/roadmap.md',
        { stdout: '- [x] [prep] [one](roadmap/M/one.md) — old\n' },
      ],
      [
        'git show :3:docs/roadmap.md',
        { stdout: '- [ ] [prep] [one](roadmap/M/one.md) — reworded\n' },
      ],
    ])
    expect(tryResolveTrivialConflicts(root, ['docs/roadmap.md'], execMod)).toBe(
      false,
    )
  })

  it('mergeOriginMainIfNeeded skips when ancestor, merges cleanly, resolves pure-add, stops on semantic', () => {
    const root = tmpRoot(true)
    expect(
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 0 }],
        ]),
        root,
        root,
        {},
        true,
      ),
    ).toEqual({ merged: false })

    expect(
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 0 }],
        ]),
        root,
        root,
        {},
        true,
      ),
    ).toEqual({ merged: true })

    const conflictRoot = tmpRoot(true)
    fs.mkdirSync(path.join(conflictRoot, 'docs'), { recursive: true })
    const base = 'header\n'
    const ours = 'header\n- [ ] a\n'
    const theirs = 'header\n- [ ] b\n'
    expect(
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 1, stderr: 'conflict\n' }],
          [
            'git diff --name-only --diff-filter=U',
            { stdout: 'docs/roadmap.md\n' },
          ],
          ['git show :1:docs/roadmap.md', { stdout: base }],
          ['git show :2:docs/roadmap.md', { stdout: ours }],
          ['git show :3:docs/roadmap.md', { stdout: theirs }],
          ['pnpm -s roadmap check', { code: 0 }],
          ['git add --', { code: 0 }],
          ['git commit --no-edit', { code: 0 }],
          ['pnpm verify:fast:quiet', { code: 0 }],
        ]),
        conflictRoot,
        conflictRoot,
        {},
        true,
      ),
    ).toMatchObject({ merged: true, resolved: ['docs/roadmap.md'] })
    expect(
      fs.readFileSync(path.join(conflictRoot, 'docs/roadmap.md'), 'utf8'),
    ).toContain('- [ ] a')
    expect(
      fs.readFileSync(path.join(conflictRoot, 'docs/roadmap.md'), 'utf8'),
    ).toContain('- [ ] b')

    expect(() =>
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 1, stderr: 'conflict\n' }],
          ['git diff --name-only --diff-filter=U', { stdout: 'src/app.ts\n' }],
        ]),
        root,
        root,
        {},
        true,
      ),
    ).toThrow(/Resolve per git-finish\.mdc/)

    expect(() =>
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 1, stderr: 'conflict\n' }],
          [
            'git diff --name-only --diff-filter=U',
            { stdout: 'docs/roadmap/M2.1/item.md\n' },
          ],
        ]),
        root,
        root,
        {},
        true,
      ),
    ).toThrow(/Resolve per git-finish\.mdc/)

    const checkFailRoot = tmpRoot(true)
    fs.mkdirSync(path.join(checkFailRoot, 'docs'), { recursive: true })
    expect(() =>
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 1, stderr: 'conflict\n' }],
          [
            'git diff --name-only --diff-filter=U',
            { stdout: 'docs/roadmap.md\n' },
          ],
          ['git show :1:docs/roadmap.md', { stdout: base }],
          ['git show :2:docs/roadmap.md', { stdout: ours }],
          ['git show :3:docs/roadmap.md', { stdout: theirs }],
          ['pnpm -s roadmap check', { code: 1, stderr: 'duplicate slug\n' }],
        ]),
        checkFailRoot,
        checkFailRoot,
        {},
        true,
      ),
    ).toThrow(/roadmap check failed.*git-finish\.mdc/s)

    const lockRoot = tmpRoot(true)
    fs.writeFileSync(path.join(lockRoot, 'pnpm-lock.yaml'), 'lock: 1\n')
    expect(
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 1, stderr: 'conflict\n' }],
          [
            'git diff --name-only --diff-filter=U',
            { stdout: 'pnpm-lock.yaml\n' },
          ],
          ['pnpm install', { code: 0 }],
          ['git add --', { code: 0 }],
          ['git commit --no-edit', { code: 0 }],
          ['pnpm verify:fast:quiet', { code: 0 }],
        ]),
        lockRoot,
        lockRoot,
        {},
        true,
      ),
    ).toMatchObject({ merged: true, resolved: ['pnpm-lock.yaml'] })
  })

  it('switchFeatureBranch reuses current branch, existing local, refuses other worktree', () => {
    const quiet = true
    const env = {}
    const cwd = '/tmp/wt-a'

    switchFeatureBranch(
      fakeExec([
        [
          'git switch -c feat/x --no-track origin/main',
          { code: 1, stderr: 'exists\n' },
        ],
        ['git branch --show-current', { stdout: 'feat/x\n' }],
      ]),
      cwd,
      env,
      quiet,
      'feat/x',
      true,
    )

    const calls = []
    const execReuse = (file, args) => {
      calls.push(`${file} ${args.join(' ')}`)
      const key = `${file} ${args.join(' ')}`
      if (key.includes('git switch -c'))
        return { code: 1, stdout: '', stderr: 'exists\n' }
      if (key.includes('git branch --show-current'))
        return { code: 0, stdout: 'main\n', stderr: '' }
      if (key.includes('git show-ref --verify'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git merge-base'))
        return { code: 0, stdout: 'abc\n', stderr: '' }
      if (key.includes('git worktree list'))
        return {
          code: 0,
          stdout: `worktree ${cwd}\nHEAD a\nbranch refs/heads/main\n`,
          stderr: '',
        }
      if (key === 'git switch feat/x')
        return { code: 0, stdout: '', stderr: '' }
      return { code: 1, stdout: '', stderr: `unhandled ${key}` }
    }
    switchFeatureBranch(execReuse, cwd, env, quiet, 'feat/x', true)
    expect(calls.some((c) => c === 'git switch feat/x')).toBe(true)

    expect(() =>
      switchFeatureBranch(
        fakeExec([
          [
            'git switch -c feat/held --no-track origin/main',
            { code: 1, stderr: 'exists\n' },
          ],
          ['git branch --show-current', { stdout: 'main\n' }],
          ['git show-ref --verify', { code: 0 }],
          [
            'git merge-base feat/held origin/main',
            { code: 0, stdout: 'abc\n' },
          ],
          [
            'git worktree list --porcelain',
            {
              stdout:
                'worktree /tmp/other\nHEAD a\nbranch refs/heads/feat/held\n\nworktree /tmp/wt-a\nHEAD b\nbranch refs/heads/main\n',
            },
          ],
        ]),
        cwd,
        env,
        quiet,
        'feat/held',
        true,
      ),
    ).toThrow(/another worktree/)

    expect(() =>
      switchFeatureBranch(
        fakeExec([
          [
            'git switch -c feat/orphan --no-track origin/main',
            { code: 1, stderr: 'exists\n' },
          ],
          ['git branch --show-current', { stdout: 'main\n' }],
          ['git show-ref --verify', { code: 0 }],
          [
            'git merge-base feat/orphan origin/main',
            { code: 1, stderr: 'unrelated\n' },
          ],
        ]),
        cwd,
        env,
        quiet,
        'feat/orphan',
        true,
      ),
    ).toThrow(/does not share history with origin\/main/)

    expect(
      branchHeldInOtherWorktree(
        fakeExec([
          [
            'git worktree list --porcelain',
            {
              stdout: `worktree ${cwd}\nHEAD a\nbranch refs/heads/feat/mine\n`,
            },
          ],
        ]),
        cwd,
        env,
        quiet,
        'feat/mine',
      ),
    ).toBeNull()

    expect(() =>
      branchHeldInOtherWorktree(
        fakeExec([
          ['git worktree list --porcelain', { code: 2, stderr: 'wt down\n' }],
        ]),
        cwd,
        env,
        quiet,
        'feat/x',
      ),
    ).toThrow(/git worktree list failed/)
  })

  it('slugFromFeatFix and pure-add empty / stages-missing edges', () => {
    expect(slugFromFeatFix('feat/a')).toBe('a')
    expect(slugFromFeatFix('fix/b')).toBe('b')
    expect(slugFromFeatFix('main')).toBeNull()
    expect(slugFromFeatFix(undefined)).toBeNull()
    expect(resolvePureAddIndexConflict('', '', '')).toBe('')
    expect(
      tryResolveTrivialConflicts(
        tmpRoot(),
        ['docs/roadmap.md'],
        fakeExec([
          ['git show :1:docs/roadmap.md', { code: 1, stderr: 'no\n' }],
        ]),
      ),
    ).toBe(false)
  })

  it('finish records push failure when mergeOriginMainIfNeeded throws AgentError', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      {
        cwd: root,
        exec: fakeExec([
          ...envOk,
          ['git status --porcelain', { stdout: '' }],
          ['git branch --show-current', { stdout: 'feat/demo\n' }],
          ['git rev-list', { stdout: '1\n' }],
          ['pnpm verify:fast:quiet', { code: 0 }],
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 1, stderr: 'conflict\n' }],
          ['git diff --name-only --diff-filter=U', { stdout: 'src/app.ts\n' }],
        ]),
        env: {},
      },
    )
    expect(r.code).toBe(1)
    const j = JSON.parse(r.out)
    expect(j.ok).toBe(false)
    expect(j.stage).toBe('push')
    expect(j.pushAttempts).toBe(1)
    expect(j.summary).toMatch(/Resolve per git-finish\.mdc/)
    expect(readPushFailures(root)).toEqual({ 'feat/demo': 1 })
  })

  it('finish records push failure when non-FF merge retry throws AgentError', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    let pushes = 0
    const exec = (file, args) => {
      const key = `${file} ${args.join(' ')}`
      if (key.includes('node -v'))
        return { code: 0, stdout: 'v22.0.0\n', stderr: '' }
      if (key.includes('command -v pnpm'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git status --porcelain'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git branch --show-current'))
        return { code: 0, stdout: 'feat/demo\n', stderr: '' }
      if (key.includes('git rev-list'))
        return { code: 0, stdout: '1\n', stderr: '' }
      if (key.includes('verify:fast:quiet'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git fetch')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git merge-base --is-ancestor')) {
        // First mergeOriginMainIfNeeded: already based; second (after reject): not
        return pushes === 0
          ? { code: 0, stdout: '', stderr: '' }
          : { code: 1, stdout: '', stderr: '' }
      }
      if (key.includes('git merge origin/main'))
        return { code: 1, stderr: 'conflict\n', stdout: '' }
      if (key.includes('git diff --name-only --diff-filter=U'))
        return { code: 0, stdout: 'src/app.ts\n', stderr: '' }
      if (key.includes('git rev-parse --git-path'))
        return {
          code: 0,
          stdout: '.git/agent-finish-push-failures.json\n',
          stderr: '',
        }
      if (key.includes('git push')) {
        pushes++
        return {
          code: 1,
          stdout: '',
          stderr: '! [rejected] non-fast-forward\n',
        }
      }
      return { code: 1, stdout: '', stderr: `unhandled ${key}` }
    }
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      { cwd: root, exec, env: {} },
    )
    expect(r.code).toBe(1)
    const j = JSON.parse(r.out)
    expect(j.ok).toBe(false)
    expect(j.stage).toBe('push')
    expect(j.pushAttempts).toBe(1)
    expect(j.summary).toMatch(/Resolve per git-finish\.mdc/)
  })

  it('finish rethrows non-AgentError from mergeOriginMainIfNeeded', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    expect(() =>
      run(
        [
          'finish',
          '--json',
          '--root',
          root,
          '--title',
          't',
          '--body-file',
          body,
        ],
        {
          cwd: root,
          exec: (file, args) => {
            const key = `${file} ${args.join(' ')}`
            if (key.includes('node -v'))
              return { code: 0, stdout: 'v22.0.0\n', stderr: '' }
            if (key.includes('command -v pnpm'))
              return { code: 0, stdout: '', stderr: '' }
            if (key.includes('git status --porcelain'))
              return { code: 0, stdout: '', stderr: '' }
            if (key.includes('git branch --show-current'))
              return { code: 0, stdout: 'feat/demo\n', stderr: '' }
            if (key.includes('git rev-list'))
              return { code: 0, stdout: '1\n', stderr: '' }
            if (key.includes('verify:fast:quiet'))
              return { code: 0, stdout: '', stderr: '' }
            if (key.includes('git fetch')) throw new TypeError('boom-fetch')
            return { code: 1, stdout: '', stderr: `unhandled ${key}` }
          },
          env: {},
        },
      ),
    ).toThrow(TypeError)
  })

  it('mergeOriginMainIfNeeded refuses empty unmerged file list', () => {
    const root = tmpRoot(true)
    expect(() =>
      mergeOriginMainIfNeeded(
        fakeExec([
          ['git fetch origin', { code: 0 }],
          ['git merge-base --is-ancestor', { code: 1 }],
          ['git merge origin/main', { code: 1, stderr: 'conflict\n' }],
          ['git diff --name-only --diff-filter=U', { stdout: '' }],
        ]),
        root,
        root,
        {},
        true,
      ),
    ).toThrow(/files: unknown/)
  })

  it('finish merges before push when origin/main is not an ancestor', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    let merged = false
    const exec = (file, args, opts) => {
      const key = `${file} ${args.join(' ')}`
      if (key.includes('node -v'))
        return { code: 0, stdout: 'v22.0.0\n', stderr: '' }
      if (key.includes('command -v pnpm'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git status --porcelain'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git branch --show-current'))
        return { code: 0, stdout: 'feat/demo\n', stderr: '' }
      if (key.includes('git rev-list'))
        return { code: 0, stdout: '1\n', stderr: '' }
      if (key.includes('verify:fast:quiet'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git fetch')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('git merge-base --is-ancestor'))
        return { code: 1, stdout: '', stderr: '' }
      if (key.includes('git merge origin/main')) {
        merged = true
        return { code: 0, stdout: '', stderr: '' }
      }
      if (key.includes('git rev-parse --git-path'))
        return {
          code: 0,
          stdout: '.git/agent-finish-push-failures.json\n',
          stderr: '',
        }
      if (key.includes('git push')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr list'))
        return {
          code: 0,
          stdout: JSON.stringify({
            number: 1,
            url: 'https://example.com/pr/1',
          }),
          stderr: '',
        }
      if (key.includes('gh pr checks --watch'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr checks --json'))
        return {
          code: 0,
          stdout: JSON.stringify([{ name: 'a', bucket: 'pass' }]),
          stderr: '',
        }
      return { code: 1, stdout: '', stderr: `unhandled ${key}` }
    }
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      { cwd: root, exec, env: {} },
    )
    expect(r.code, r.err).toBe(0)
    expect(merged).toBe(true)
    expect(JSON.parse(r.out).ok).toBe(true)
  })

  it('finish merges on non-fast-forward reject then pushes', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    let pushes = 0
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
      ['pnpm verify:fast:quiet', { code: 0 }],
      ['git fetch origin', { code: 0 }],
      ['git merge-base --is-ancestor', { code: 0 }],
      [
        'git push',
        () => {
          pushes++
          if (pushes === 1)
            return {
              code: 1,
              stderr: '! [rejected] non-fast-forward\n',
            }
          return { code: 0, stdout: '', stderr: '' }
        },
      ],
      ['git merge-base --is-ancestor', { code: 1 }],
      ['git merge origin/main', { code: 0 }],
      [
        'gh pr list',
        { stdout: '{"number":1,"url":"https://example.com/pr/1"}' },
      ],
      ['gh pr checks --watch', { code: 0 }],
      [
        'gh pr checks --json',
        { stdout: JSON.stringify([{ name: 'a', bucket: 'pass' }]) },
      ],
    ])
    // Second merge-base after reject: force not-ancestor then clean merge.
    const base = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
      ['pnpm verify:fast:quiet', { code: 0 }],
      ['git fetch origin', { code: 0 }],
    ])
    let pushCount = 0
    let ancestorCalls = 0
    const wrapped = (file, args, opts) => {
      const key = `${file} ${args.join(' ')}`
      if (key.includes('git push')) {
        pushCount++
        if (pushCount === 1)
          return { code: 1, stderr: 'updates were rejected\n', stdout: '' }
        return { code: 0, stdout: '', stderr: '' }
      }
      if (key.includes('git merge-base --is-ancestor')) {
        ancestorCalls++
        // First finish merge check: already ancestor; after reject: need merge.
        return { code: ancestorCalls === 1 ? 0 : 1, stdout: '', stderr: '' }
      }
      if (key.includes('git merge origin/main'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr list'))
        return {
          code: 0,
          stdout: JSON.stringify({
            number: 1,
            url: 'https://example.com/pr/1',
          }),
          stderr: '',
        }
      if (key.includes('gh pr checks --watch'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr checks --json'))
        return {
          code: 0,
          stdout: JSON.stringify([{ name: 'a', bucket: 'pass' }]),
          stderr: '',
        }
      return base(file, args, opts)
    }
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      { cwd: root, exec: wrapped, env: {} },
    )
    expect(r.code, r.err).toBe(0)
    expect(pushCount).toBe(2)
    expect(JSON.parse(r.out).ok).toBe(true)
  })
})

describe('linked worktree preflight --slug', () => {
  it('creates feat branch from origin/main while main is checked out elsewhere', () => {
    const primary = gitInitRepo()
    execFileSync('git', ['branch', '-M', 'main'], {
      cwd: primary,
      stdio: 'ignore',
    })
    execFileSync('git', ['checkout', '-b', 'origin-main-tmp'], {
      cwd: primary,
      stdio: 'ignore',
    })
    // Simulate origin/main as a local ref the worktree can track.
    execFileSync('git', ['branch', 'origin/main', 'main'], {
      cwd: primary,
      stdio: 'ignore',
    })
    execFileSync('git', ['checkout', 'main'], { cwd: primary, stdio: 'ignore' })
    const wt = path.join(os.tmpdir(), `agent-wt-${path.basename(primary)}`)
    tmpDirs.push(wt)
    execFileSync('git', ['worktree', 'add', '--detach', wt], {
      cwd: primary,
      stdio: 'ignore',
    })
    fs.writeFileSync(path.join(wt, '.nvmrc'), '22\n')
    fs.mkdirSync(path.join(wt, 'openspec', 'changes'), { recursive: true })
    fs.mkdirSync(path.join(wt, 'docs/roadmap/M2.1'), { recursive: true })
    fs.writeFileSync(
      path.join(wt, 'docs/roadmap.md'),
      '# R\n\n## M2.1 — t\n\n- [ ] [prep] [wt-slug](roadmap/M2.1/wt-slug.md) — t\n',
    )
    fs.writeFileSync(
      path.join(wt, 'docs/roadmap/M2.1/wt-slug.md'),
      '# wt-slug\n\nTag: prep\nMilestone: M2.1\nTitle: t\n',
    )
    execFileSync('git', ['add', '-A'], { cwd: wt, stdio: 'ignore' })
    execFileSync(
      'git',
      [
        '-c',
        'user.email=t@t.com',
        '-c',
        'user.name=t',
        'commit',
        '-m',
        'wt fixture',
      ],
      {
        cwd: wt,
        stdio: 'ignore',
      },
    )
    // Real git for worktree ops; stub only external tools + roadmap next path via thin wrapper.
    const real = defaultExec
    const exec = (file, args, opts = {}) => {
      const key = `${file} ${args.join(' ')}`
      if (key.includes('node -v'))
        return { code: 0, stdout: 'v22.0.0\n', stderr: '' }
      if (key.includes('command -v pnpm'))
        return { code: 0, stdout: '', stderr: '' }
      if (key.includes('gh pr list')) return { code: 0, stdout: '', stderr: '' }
      if (key.includes('pnpm') && key.includes('roadmap next')) {
        return {
          code: 0,
          stdout: JSON.stringify({
            slug: 'wt-slug',
            tag: 'prep',
            title: 't',
            file: 'docs/roadmap/M2.1/wt-slug.md',
            milestone: 'M2.1',
            goal: ['g'],
          }),
          stderr: '',
        }
      }
      if (key.includes('openspec new') || key.includes('openspec instructions'))
        return {
          code: 0,
          stdout: JSON.stringify({ template: 'T', rules: ['r'] }),
          stderr: '',
        }
      // Map origin/main for switch --no-track when remote is absent.
      if (key.includes('git switch -c feat/wt-slug --no-track origin/main')) {
        return real(
          'git',
          ['switch', '-c', 'feat/wt-slug', '--no-track', 'main'],
          { ...opts, cwd: wt },
        )
      }
      if (key.includes('git fetch')) return { code: 0, stdout: '', stderr: '' }
      return real(file, args, { ...opts, cwd: opts.cwd ?? wt })
    }
    const r = cmdPreflight(
      { slug: 'wt-slug' },
      { root: wt, cwd: wt, env: {}, exec, quiet: true },
    )
    expect(r.ok).toBe(true)
    expect(r.item.slug).toBe('wt-slug')
    expect(r.branch).toBe('feat/wt-slug')
    const br = execFileSync('git', ['branch', '--show-current'], {
      cwd: wt,
      encoding: 'utf8',
    }).trim()
    expect(br).toBe('feat/wt-slug')
    const mainBr = execFileSync('git', ['branch', '--show-current'], {
      cwd: primary,
      encoding: 'utf8',
    }).trim()
    expect(mainBr).toBe('main')
  })
})

describe('E2E_PORT config', () => {
  it('playwright config wires E2E_PORT and disables server reuse', () => {
    const src = fs.readFileSync(
      path.join(here, '..', 'playwright.config.ts'),
      'utf8',
    )
    expect(src).toMatch(/E2E_PORT \?\? ['"]4173['"]/)
    expect(src).toMatch(/reuseExistingServer:\s*false/)
    expect(src).toMatch(/--port \$\{e2ePort\}/)
  })
})
