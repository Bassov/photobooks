import { stripProcessGitEnv } from '@albasov/ts-agent-rig/strip-git-env'
import { fc } from '@fast-check/vitest'
import { localFcNumRuns } from './unit-changed.mjs'

stripProcessGitEnv()
// check.mjs may set these on roadmap children only; never let a leaked parent
// env change how roadmap.mjs / check tests behave vs plain CI `test:coverage`.
delete process.env.PHOTOBOOKS_CHECK_INNER
delete process.env.CHECK_VERBOSE

// Local scoped runs (scripts/unit-changed.mjs) lower the default numRuns; CI keeps it.
const numRuns = localFcNumRuns(process.env)
if (numRuns !== undefined) fc.configureGlobal({ numRuns })
