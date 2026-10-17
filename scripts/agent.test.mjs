import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseArgs, run, stripAnsi } from './agent.mjs'

const tmpDirs = []
afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop(), { recursive: true, force: true })
  }
})

function tmpRoot() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cli-'))
  tmpDirs.push(d)
  fs.writeFileSync(path.join(d, '.nvmrc'), '22\n')
  fs.mkdirSync(path.join(d, 'openspec', 'changes'), { recursive: true })
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

describe('parseArgs / stripAnsi', () => {
  it('parses bool and value flags', () => {
    const o = parseArgs([
      'preflight',
      '--json',
      '--quiet',
      '--skip',
      'a,b',
      '--root',
      '.',
    ])
    expect(o._).toEqual(['preflight'])
    expect(o.json).toBe(true)
    expect(o.quiet).toBe(true)
    expect(o.skip).toBe('a,b')
    expect(o.root).toBe('.')
  })

  it('strips ANSI', () => {
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red')
  })
})

describe('preflight', () => {
  it('happy path --json', () => {
    const root = tmpRoot()
    const item = {
      slug: 'agent-pipeline-fewer-calls',
      tag: 'prep',
      title: 'Fewer calls',
      file: 'docs/roadmap/M2.1/agent-pipeline-fewer-calls.md',
    }
    const exec = fakeExec([
      ['node -v', { stdout: 'v22.23.3\n' }],
      ['command -v pnpm', { code: 0 }],
      ['git status --porcelain', { stdout: '' }],
      ['git fetch origin', { code: 0 }],
      ['git switch main', { code: 0 }],
      ['git pull --ff-only', { code: 0 }],
      ['gh pr list', { stdout: '' }],
      ['git branch -r', { stdout: '  origin/main\n' }],
      ['pnpm -s roadmap next --json', { stdout: JSON.stringify(item) }],
      ['git switch -c feat/agent-pipeline-fewer-calls', { code: 0 }],
      ['openspec new change', { code: 0 }],
      [
        'openspec instructions proposal',
        {
          stdout: JSON.stringify({
            template: '# Proposal\n',
            rules: ['Keep proposals under 400 words'],
          }),
        },
      ],
    ])
    // create change dir after "new change" would — simulate missing then present
    const r = run(['preflight', '--json', '--root', root], {
      cwd: root,
      exec,
      env: { ...process.env, CI: '' },
    })
    expect(r.code, r.err).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.item.slug).toBe(item.slug)
    expect(j.branch).toBe('feat/agent-pipeline-fewer-calls')
    expect(j.instructions.rules).toHaveLength(1)
    expect(j.touchSet).toBe('TBD until design.md')
  })

  it('fails on dirty tree', () => {
    const root = tmpRoot()
    const exec = fakeExec([
      ['node -v', { stdout: 'v22.0.0\n' }],
      ['command -v pnpm', { code: 0 }],
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
})

describe('finish', () => {
  it('refuses dirty tree', () => {
    const root = tmpRoot()
    const exec = fakeExec([
      ['node -v', { stdout: 'v22.0.0\n' }],
      ['command -v pnpm', { code: 0 }],
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

  it('stops after two failed pushes', () => {
    const root = tmpRoot()
    let pushes = 0
    const exec = fakeExec([
      ['node -v', { stdout: 'v22.0.0\n' }],
      ['command -v pnpm', { code: 0 }],
      ['git status --porcelain', { stdout: '' }],
      ['pnpm verify:fast:quiet', { code: 0 }],
      [
        'git push',
        () => {
          pushes++
          return { code: 1, stderr: 'pre-push failed\n' }
        },
      ],
    ])
    const r = run(['finish', '--json', '--root', root], {
      cwd: root,
      exec,
      env: {},
    })
    expect(r.code).toBe(1)
    const j = JSON.parse(r.out)
    expect(j.ok).toBe(false)
    expect(j.stage).toBe('push')
    expect(j.pushAttempts).toBe(2)
    expect(pushes).toBe(2)
  })
})

describe('review-brief', () => {
  it('prints brief shape', () => {
    const root = tmpRoot()
    const change = path.join(root, 'openspec', 'changes', 'demo')
    fs.mkdirSync(change, { recursive: true })
    fs.writeFileSync(
      path.join(change, 'design.md'),
      `# Design\n\n## Touch-set\n\n| File | Why |\n| ---- | --- |\n| \`scripts/agent.mjs\` | cli |\n| \`AGENTS.md\` | nav |\n`,
    )
    const exec = fakeExec([
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['git diff --stat', { stdout: ' AGENTS.md | 2 +\n' }],
      ['git diff --', { stdout: 'diff --git a/scripts/agent.mjs\n+hi\n' }],
    ])
    const r = run(
      ['review-brief', '--json', '--root', root, '--rules-json', '["rule-a"]'],
      { cwd: root, exec, env: {} },
    )
    expect(r.code, r.err).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.slug).toBe('demo')
    expect(j.changePath).toBe('openspec/changes/demo')
    expect(j.rules).toEqual(['rule-a'])
    expect(j.touchSetPaths).toContain('scripts/agent.mjs')
    expect(j.diffStat).toContain('AGENTS.md')
  })
})

describe('quiet', () => {
  it('strips ANSI from child output in finish summary path', () => {
    const root = tmpRoot()
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, '## Summary\n')
    const exec = fakeExec([
      ['node -v', { stdout: 'v22.0.0\n' }],
      ['command -v pnpm', { code: 0 }],
      ['git status --porcelain', { stdout: '' }],
      ['pnpm verify:fast:quiet', { code: 0 }],
      ['git push', { code: 0 }],
      ['git branch --show-current', { stdout: 'feat/demo\n' }],
      ['gh pr list --head', { stdout: 'null\n' }],
      [
        'gh pr create',
        { stdout: '\u001b[32mhttps://example.com/pr/1\u001b[0m\n' },
      ],
      ['gh pr checks --watch', { code: 0 }],
      [
        'gh pr checks --json',
        {
          stdout: JSON.stringify([{ name: 'test', bucket: 'pass' }]),
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
    expect(j.prUrl).toBe('https://example.com/pr/1')
    expect(j.ok).toBe(true)
    expect(j.checks).toEqual(['test: pass'])
  })
})
