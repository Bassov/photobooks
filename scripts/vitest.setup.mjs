import { stripProcessGitEnv } from '@albasov/ts-agent-rig/strip-git-env'
import { configureLocalFcNumRuns } from './unit-changed.mjs'

stripProcessGitEnv()
// check.mjs may set these on roadmap children only; never let a leaked parent
// env change how roadmap.mjs / check tests behave vs plain CI `test:coverage`.
delete process.env.PHOTOBOOKS_CHECK_INNER
delete process.env.CHECK_VERBOSE
// Local scoped runs lower the default fast-check numRuns; CI keeps it.
configureLocalFcNumRuns(process.env)
