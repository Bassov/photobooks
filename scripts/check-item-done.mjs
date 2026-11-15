#!/usr/bin/env node
// Integrity gate: an item branch (`feat|fix/<slug>`) must close its own
// roadmap item (`Status: done` in docs/roadmap/<M>/<slug>.md) before it ships.
// Finalize writes the line before it runs check:integrity; a run that skips
// finalize (lite track, #620 / #622) fails here in pre-push C1 and in CI.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function slugFromBranch(branch) {
  const m = /^(?:feat|fix)\/(.+)$/.exec(branch ?? '')
  return m ? m[1] : null
}

export function findItemFile(root, slug) {
  const dir = path.join(root, 'docs', 'roadmap')
  if (!fs.existsSync(dir)) return null
  for (const m of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!m.isDirectory()) continue
    const f = path.join(dir, m.name, `${slug}.md`)
    if (fs.existsSync(f)) return f
  }
  return null
}

/** @returns {{ ok: boolean, message: string }} */
export function checkItemDone({ root, branch }) {
  const slug = slugFromBranch(branch)
  if (!slug)
    return { ok: true, message: `item-done: skip (${branch || 'no branch'})` }
  const file = findItemFile(root, slug)
  if (!file)
    return { ok: true, message: `item-done: skip (no roadmap item ${slug})` }
  const rel = path.relative(root, file).replaceAll('\\', '/')
  if (/^Status: done$/m.test(fs.readFileSync(file, 'utf8'))) {
    return { ok: true, message: `item-done: ${slug} ok` }
  }
  return {
    ok: false,
    message: `item-done: ${rel} has no "Status: done". Run \`pnpm -s agent finalize ${slug}\` (lite too; docs/agent-loop.md "10–11 · Finalize") or \`pnpm roadmap done ${slug}\`, then commit.`,
  }
}

/** CI checks out a merge ref: the PR branch comes from GITHUB_HEAD_REF. */
export function currentBranch(root, env) {
  if (env.GITHUB_HEAD_REF) return env.GITHUB_HEAD_REF
  const r = spawnSync('git', ['branch', '--show-current'], {
    cwd: root,
    encoding: 'utf8',
  })
  return r.status === 0 ? r.stdout.trim() : ''
}

/** @returns {number} exit code */
export function main({ root, env, log, error }) {
  const r = checkItemDone({ root, branch: currentBranch(root, env) })
  ;(r.ok ? log : error)(r.message)
  return r.ok ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main({
    root: process.cwd(),
    env: process.env,
    log: console.log,
    error: console.error,
  })
}
