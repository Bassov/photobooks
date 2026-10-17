import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
import {
  branchPrefixForItem,
  defaultExec,
  isFailingBucket,
  isFeatureBranch,
  isPassingBucket,
  main,
  mustOk,
  parseArgs,
  parseInstructions,
  parseRoadmapNext,
  parseTouchSetPaths,
  readNvmrcMajor,
  readPushFailures,
  run,
  runIdFromCheckLink,
  slugFromBranch,
  stripAnsi,
  tailOutput,
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
    return { code: 1, stdout: '', stderr: `unhandled: ${key}` }
  }
}

const envOk = [
  ['node -v', { stdout: 'v22.23.3\n' }],
  ['command -v pnpm', { code: 0 }],
]

describe('pure helpers', () => {
  it('parseArgs / stripAnsi / tailOutput', () => {
    const o = parseArgs([
      'preflight',
      '--json',
      '--quiet',
      '--skip',
      'a,b',
      '--root',
      '.',
    ])
    expect(o.json).toBe(true)
    expect(o.skip).toBe('a,b')
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red')
    expect(tailOutput('a\n'.repeat(100), '', 3).split('\n')).toHaveLength(3)
    expect(tailOutput('', '')).toBe('(no output)')
    const eq = parseArgs(['finish', '--root=./repo', '--title=Hi'])
    expect(eq.root).toBe('./repo')
    expect(eq.title).toBe('Hi')
  })

  it('parseArgs rejects unknown and missing values', () => {
    expect(() => parseArgs(['x', '--nope'])).toThrow(/unknown option/)
    expect(() => parseArgs(['x', '--root'])).toThrow(/needs a value/)
    expect(() => parseArgs(['x', '--root', '--json'])).toThrow(/needs a value/)
  })

  it('mustOk tails combined streams', () => {
    expect(() =>
      mustOk(
        { code: 1, stdout: 'ELIFECYCLE\n', stderr: 'real error line\n' },
        'verify',
      ),
    ).toThrow(/real error line/)
  })

  it('roadmap / instructions / touch-set parsers', () => {
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
    expect(j.slug).toBe('s')
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
    expect(text.body).toContain('body line')
    expect(text.goal).toEqual(['one', 'two'])
    expect(parseInstructions('{"template":"T","rules":["r"]}')).toEqual({
      template: 'T',
      rules: ['r'],
    })
    expect(() => parseInstructions('nope')).toThrow()
    expect(
      parseTouchSetPaths('| `scripts/agent.mjs` | cli |\n| File | Why |'),
    ).toEqual(['scripts/agent.mjs'])
  })

  it('branch helpers and check buckets', () => {
    expect(branchPrefixForItem({ tag: 'prep', title: 'x' })).toBe('feat')
    expect(branchPrefixForItem({ tag: 'fix', title: 'x' })).toBe('fix')
    expect(branchPrefixForItem({ tag: 'prep', title: 'fix a bug' })).toBe('fix')
    expect(isFeatureBranch('feat/x')).toBe(true)
    expect(isFeatureBranch('main')).toBe(false)
    expect(slugFromBranch('feat/demo')).toBe('demo')
    expect(isFailingBucket('fail')).toBe(true)
    expect(isFailingBucket('pending')).toBe(true)
    expect(isFailingBucket('pass')).toBe(false)
    expect(isPassingBucket('skipping')).toBe(true)
    expect(isPassingBucket('neutral')).toBe(true)
    expect(isPassingBucket('fail')).toBe(false)
    expect(runIdFromCheckLink('https://x/actions/runs/12345/job/1')).toBe(
      '12345',
    )
    expect(runIdFromCheckLink(null)).toBe(null)
    // body delimiter on first line (index 0) — kills bodyIdx>=0 → bodyIdx>0
    const bodyFirst = parseRoadmapNext('---\nslug: s\nrest\n')
    expect(bodyFirst.slug).toBe('s')
    expect(bodyFirst.body).toBe('slug: s\nrest\n')
  })

  it('readNvmrcMajor and push failure persistence', () => {
    const root = tmpRoot(true)
    expect(readNvmrcMajor(root)).toBe(22)
    expect(readPushFailures(root)).toEqual({})
    writePushFailures(root, { 'feat/x': 1 })
    expect(readPushFailures(root)['feat/x']).toBe(1)
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
    expect(j.item.body).toContain('Scope')
    expect(j.item.goal).toEqual(['goal text'])
    expect(j.item.milestone).toContain('M2.1')
    expect(j.skips).toEqual(expect.arrayContaining(['other', 'remote-one']))
    expect(j.instructions.rules).toHaveLength(1)
  })

  it('text mode prints full rules and template', () => {
    const root = tmpRoot()
    const item = { slug: 'demo-item', tag: 'prep', title: 't', file: 'f' }
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
    expect(r.out).toContain('rule-one')
    expect(r.out).toContain('# Proposal')
  })

  it('fails on dirty tree', () => {
    const root = tmpRoot()
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: ' M README.md\n' }],
    ])
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).toBe(2)
    expect(JSON.parse(r.err).error).toMatch(/not clean/)
  })

  it('fails when gh pr list fails', () => {
    const root = tmpRoot()
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git fetch origin', { code: 0 }],
      ['git switch main', { code: 0 }],
      ['git pull --ff-only', { code: 0 }],
      ['gh pr list', { code: 1, stderr: 'auth required\n' }],
    ])
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).not.toBe(0)
    expect(JSON.parse(r.err).error).toMatch(/gh pr list failed/)
  })

  it('fails when openspec instructions fails', () => {
    const root = tmpRoot()
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'demo-item'), {
      recursive: true,
    })
    const item = { slug: 'demo-item', tag: 'prep', title: 't', file: 'f' }
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
      [
        'openspec instructions proposal',
        { code: 1, stderr: 'no such artifact\n' },
      ],
    ])
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).not.toBe(0)
    expect(JSON.parse(r.err).error).toMatch(/openspec instructions failed/)
  })
})

describe('finish', () => {
  function finishBase(root, extra = []) {
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
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '?? x\n' }],
    ])
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toMatch(/commit first/)
  })

  it('refuses main (F2)', () => {
    const root = tmpRoot(true)
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git branch --show-current', { stdout: 'main\n' }],
    ])
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toMatch(/refuses branch "main"/)
  })

  it('refuses zero commits ahead of origin/main (F2)', () => {
    const root = tmpRoot(true)
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['git rev-list --count origin/main..HEAD', { stdout: '0\n' }],
    ])
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).toBe(1)
    expect(JSON.parse(r.err).error).toMatch(/no commits ahead/)
  })

  it('verify failure includes real error tail (F3)', () => {
    const root = tmpRoot(true)
    const exec = fakeExec([
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
    ])
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).not.toBe(0)
    expect(JSON.parse(r.err).error).toMatch(/expected 1 to be 2/)
  })

  it('one push per call and persists budget (S2)', () => {
    const root = tmpRoot(true)
    let pushes = 0
    const pushFail = () => {
      pushes++
      return { code: 1, stderr: 'pre-push failed\n' }
    }
    const exec1 = finishBase(root, [['git push', pushFail]])
    const r1 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: exec1,
      env: {},
    })
    expect(r1.code).toBe(1)
    expect(JSON.parse(r1.out).pushAttempts).toBe(1)
    expect(pushes).toBe(1)
    expect(readPushFailures(root)['feat/demo']).toBe(1)

    const exec2 = finishBase(root, [['git push', pushFail]])
    const r2 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: exec2,
      env: {},
    })
    expect(JSON.parse(r2.out).pushAttempts).toBe(2)
    expect(pushes).toBe(2)

    const exec3 = finishBase(root, [
      [
        'git push',
        () => {
          throw new Error('should not push when budget exhausted')
        },
      ],
    ])
    const r3 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: exec3,
      env: {},
    })
    expect(JSON.parse(r3.out).summary).toMatch(/budget exhausted/)
    expect(pushes).toBe(2)
  })

  it('happy path treats skipping as pass and uses run id on fail (S3/F3)', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, '## Summary\n')
    const exec = finishBase(root, [
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
    ])
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
      { cwd: root, exec, env: { CI: '1' } },
    )
    expect(r.code, r.err).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.ok).toBe(true)
    expect(j.prUrl).toBe('https://example.com/pr/1')
  })

  it('fetches log-failed with run id from check link', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'x\n')
    let viewed = null
    const exec = finishBase(root, [
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
    ])
    const r = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      { cwd: root, exec, env: {} },
    )
    expect(r.code).toBe(1)
    expect(viewed).toContain('999')
    expect(JSON.parse(r.out).logTail).toMatch(/job failed detail/)
  })
})

describe('review-brief real git (F5)', () => {
  it('includes untracked touch-set file and outsideTouchSet diff', () => {
    const repo = gitInitRepo()
    const change = path.join(repo, 'openspec', 'changes', 'demo')
    fs.mkdirSync(change, { recursive: true })
    fs.writeFileSync(
      path.join(change, 'design.md'),
      `# Design\n\n## Touch-set\n\n| File | Why |\n| ---- | --- |\n| \`scripts/agent.mjs\` | cli |\n| \`in-touch.txt\` | tracked |\n`,
    )
    fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true })
    // untracked in touch-set
    fs.writeFileSync(
      path.join(repo, 'scripts', 'agent.mjs'),
      'export const x=1\n',
    )
    // tracked edit outside touch-set
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'changed\n')
    // untracked outside
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
    expect(j.untracked).toEqual(
      expect.arrayContaining(['scripts/agent.mjs', 'outside.txt']),
    )
    expect(j.touchDiff).toMatch(/agent\.mjs/)
    expect(j.outsideTouchSet).toEqual(
      expect.arrayContaining(['tracked.txt', 'outside.txt']),
    )
    expect(j.outsideDiff).toMatch(/tracked\.txt|outside\.txt/)
    expect(j.diffStat).toMatch(/\?\?/)
  })
})

describe('help / errors', () => {
  it('help and unknown command', () => {
    expect(run(['help']).code).toBe(0)
    expect(run(['--help']).code).toBe(0)
    expect(run([]).code).toBe(2)
    const u = run(['nope', '--json'])
    expect(u.code).toBe(2)
    expect(JSON.parse(u.err).error).toMatch(/unknown command/)
    const extra = run(['preflight', 'extra', '--json'])
    expect(extra.code).toBe(2)
    expect(JSON.parse(extra.err).error).toMatch(/unexpected argument/)
  })

  it('defaultExec and main()', () => {
    const ok = defaultExec('node', ['-e', 'process.stdout.write("hi")'])
    expect(ok.code).toBe(0)
    expect(ok.stdout).toBe('hi')
    const bad = defaultExec('node', ['-e', 'process.exit(3)'])
    expect(bad.code).toBe(3)
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
    expect(io.stdout.buf).toMatch(/usage:/)
    expect(io.exitCode).toBe(0)
    main(['nope'], io)
    expect(io.stderr.buf).toMatch(/unknown command/)
    expect(io.exitCode).toBe(2)
    const spawned = execFileSync(
      process.execPath,
      [path.join(here, 'agent.mjs'), 'help'],
      {
        encoding: 'utf8',
      },
    )
    expect(spawned).toMatch(/usage:/)
  })
})

describe('more preflight / finish / brief branches', () => {
  it('env failures: node major and missing pnpm', () => {
    const root = tmpRoot()
    const r1 = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([['node -v', { stdout: 'v18.0.0\n' }]]),
      env: {},
    })
    expect(JSON.parse(r1.err).error).toMatch(/node major/)
    const r2 = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ['node -v', { stdout: 'v22.0.0\n' }],
        ['command -v pnpm', { code: 1 }],
      ]),
      env: {},
    })
    expect(JSON.parse(r2.err).error).toMatch(/pnpm not on PATH/)
  })

  it('parseRoadmapNext failures and text goal string fmt', () => {
    expect(() => parseRoadmapNext('{}')).toThrow(/missing slug/)
    expect(() => parseRoadmapNext('not json and no slug')).toThrow(/no slug/)
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
    const exec = fakeExec([
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git fetch origin', { code: 0 }],
      ['git switch main', { code: 0 }],
      ['git pull --ff-only', { code: 0 }],
      ['gh pr list', { stdout: '' }],
      ['git branch -r', { stdout: '' }],
      ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
      ['git switch -c feat/demo-item', { code: 1, stderr: 'exists\n' }],
      ['git switch feat/demo-item', { code: 0 }],
      [
        'openspec instructions proposal',
        { stdout: JSON.stringify({ template: null, rules: [] }) },
      ],
    ])
    // empty rules array should fail
    const badRules = run(['preflight', '--json', '--root', root], {
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
    expect(JSON.parse(badRules.err).error).toMatch(/missing rules/)

    const ok = run(['preflight', '--root', root], {
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
        ['git switch feat/demo-item', { code: 0 }],
        [
          'openspec instructions proposal',
          { stdout: JSON.stringify({ template: null, rules: ['only'] }) },
        ],
      ]),
      env: {},
    })
    expect(ok.code, ok.err).toBe(0)
    expect(ok.out).toMatch(/goal: single-goal/)
    expect(ok.out).toMatch(/touchSet: openspec\/changes\/demo-item\/design.md/)
  })

  it('finish: checks query fail, invalid JSON, fail without link, text fmt, clear budget', () => {
    const root = tmpRoot(true)
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'b\n')
    writePushFailures(root, { 'feat/demo': 1 })

    const base = [
      ...envOk,
      ['git status --porcelain', { stdout: '' }],
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
      ['pnpm verify:fast:quiet', { code: 0 }],
      ['git push', { code: 0 }],
      [
        'gh pr list --head',
        { stdout: JSON.stringify({ number: 9, url: 'https://pr/9' }) },
      ],
      ['gh pr checks --watch', { code: 0 }],
    ]

    const qFail = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...base,
        ['gh pr checks --json', { code: 1, stderr: 'rate limit\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(qFail.out).summary).toMatch(/rate limit/)

    const badJson = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...base,
        ['gh pr checks --json', { stdout: '{not-array}' }],
      ]),
      env: {},
    })
    expect(JSON.parse(badJson.out).summary).toMatch(/invalid JSON/)

    const noLink = run(['finish', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...base,
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
    expect(noLink.code).toBe(1)
    expect(noLink.out).toMatch(/no actions\/runs link/)

    // success clears prior push failure
    const ok = run(
      ['finish', '--json', '--root', root, '--title', 't', '--body-file', body],
      {
        cwd: root,
        exec: fakeExec([
          ...base,
          [
            'gh pr checks --json',
            {
              stdout: JSON.stringify([
                { name: 'a', bucket: 'pass' },
                { name: 'b', bucket: 'neutral' },
              ]),
            },
          ],
        ]),
        env: {},
      },
    )
    expect(ok.code, ok.err).toBe(0)
    expect(readPushFailures(root)['feat/demo']).toBeUndefined()
  })

  it('finish create needs title/body-file; review-brief invalid rules and no design', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
        ['pnpm verify:fast:quiet', { code: 0 }],
        ['git push', { code: 0 }],
        ['gh pr list --head', { stdout: 'null\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r.err).error).toMatch(/--title/)

    const brief = run(
      ['review-brief', '--json', '--root', root, '--rules-json', '{'],
      {
        cwd: root,
        exec: fakeExec([['git branch --show-current', { stdout: 'feat/z\n' }]]),
        env: {},
      },
    )
    expect(JSON.parse(brief.err).error).toMatch(/valid JSON/)

    const repo = gitInitRepo()
    const b2 = run(['review-brief', '--change', 'missing', '--root', repo], {
      cwd: repo,
      env: {},
    })
    expect(b2.code).toBe(0)
    expect(b2.out).toMatch(/design.md missing/)
  })

  it('git branch -r failure in skip-list', () => {
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
    expect(JSON.parse(r.err).error).toMatch(/git branch -r failed/)
  })
})

describe('branch coverage extras', () => {
  it('readNvmrcMajor missing / bad; node -v fail; rev-list NaN; body-file missing', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bare-'))
    tmpDirs.push(bare)
    expect(readNvmrcMajor(bare)).toBe(null)
    fs.writeFileSync(path.join(bare, '.nvmrc'), 'nope\n')
    expect(readNvmrcMajor(bare)).toBe(null)

    const root = tmpRoot(true)
    const r1 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ['node -v', { code: 1, stderr: 'gone\n' }],
        ['command -v pnpm', { code: 0 }],
      ]),
      env: {},
    })
    expect(JSON.parse(r1.err).error).toMatch(/node major/)

    const r2 = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: 'NaN\n' }],
      ]),
      env: {},
    })
    expect(JSON.parse(r2.err).error).toMatch(/no commits ahead/)

    const r3 = run(
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
        exec: fakeExec([
          ...envOk,
          ['git status --porcelain', { stdout: '' }],
          ['git branch --show-current', { stdout: 'feat/demo\n' }],
          ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
          ['pnpm verify:fast:quiet', { code: 0 }],
          ['git push', { code: 0 }],
          ['gh pr list --head', { stdout: 'null\n' }],
        ]),
        env: {},
      },
    )
    expect(JSON.parse(r3.err).error).toMatch(/body file missing/)
  })

  it('review-brief with only untracked outside and empty touch diffs', () => {
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
      {
        cwd: repo,
        env: {},
      },
    )
    expect(r.code).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.outsideTouchSet).toContain('only-out.txt')
    expect(j.touchDiff).toBe('(empty)')
  })

  it('finish text mode and invalid checks array shape', () => {
    const root = tmpRoot(true)
    const r = run(['finish', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git branch --show-current', { stdout: 'feat/demo\n' }],
        ['git rev-list --count origin/main..HEAD', { stdout: '1\n' }],
        ['pnpm verify:fast:quiet', { code: 0 }],
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
})

describe('final branch hits', () => {
  it('corrupt push-fail file; invalid instructions JSON; empty rules text; write without .git; non-AgentError', () => {
    const root = tmpRoot(true)
    fs.writeFileSync(pushFailPath(root), '{not-json')
    expect(readPushFailures(root)).toEqual({})

    const noGit = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-nogit-'))
    tmpDirs.push(noGit)
    expect(() => writePushFailures(noGit, {})).toThrow(/\.git missing/)

    const item = { slug: 'demo-item', tag: 'prep', title: 't', file: 'f' }
    fs.mkdirSync(path.join(root, 'openspec', 'changes', 'demo-item'), {
      recursive: true,
    })
    const badInstr = run(['preflight', '--json', '--root', root], {
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
    expect(JSON.parse(badInstr.err).error).toMatch(/invalid JSON/)

    const emptyRules = run(['preflight', '--root', root], {
      cwd: root,
      exec: fakeExec([
        ...envOk,
        ['git status --porcelain', { stdout: '' }],
        ['git fetch origin', { code: 0 }],
        ['git switch main', { code: 0 }],
        ['git pull --ff-only', { code: 0 }],
        ['gh pr list', { stdout: '' }],
        ['git branch -r', { stdout: '' }],
        [
          'pnpm -s roadmap next --json',
          { stdout: JSON.stringify({ ...item, goal: null, body: null }) },
        ],
        ['git switch -c feat/demo-item', { code: 0 }],
        [
          'openspec instructions proposal',
          { stdout: JSON.stringify({ template: null, rules: [] }) },
        ],
      ]),
      env: {},
    })
    expect(emptyRules.code).toBe(0)
    expect(emptyRules.out).toMatch(/\(none\)/)

    expect(() =>
      run(['preflight', '--root', root], {
        cwd: root,
        exec: () => {
          throw new TypeError('boom')
        },
        env: {},
      }),
    ).toThrow(/boom/)
  })
})
