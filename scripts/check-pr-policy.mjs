#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPrPolicyCheck } from './check-gate-ratchet.mjs'

process.exitCode = runPrPolicyCheck({
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
})
