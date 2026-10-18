#!/usr/bin/env node
/**
 * Local optional pnpm check entry: ratchet working tree vs origin/main when available.
 * CI truth is `.github/workflows/pr-policy.yml` (base script + head as data).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGateRatchetCli } from './check-gate-ratchet.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function git(args) {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    if (k.startsWith('GIT_')) delete env[k]
  }
  return spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env,
  })
}

function resolveBaseRef() {
  const fromEnv = process.env.GATE_RATCHET_BASE?.trim()
  if (fromEnv) return fromEnv
  const origin = git(['rev-parse', 'origin/main'])
  if (origin.status === 0) return origin.stdout.trim()
  const main = git(['rev-parse', 'main'])
  if (main.status === 0) return main.stdout.trim()
  return null
}

const base = resolveBaseRef()
if (!base) {
  console.log('pr-policy: skip (no origin/main or GATE_RATCHET_BASE)')
  process.exitCode = 0
} else {
  const head = git(['rev-parse', 'HEAD'])
  if (head.status !== 0) {
    console.error('pr-policy: cannot resolve HEAD')
    process.exitCode = 1
  } else {
    process.exitCode = runGateRatchetCli([
      '--cwd',
      ROOT,
      '--base-ref',
      base,
      '--head-ref',
      head.stdout.trim(),
    ])
  }
}
