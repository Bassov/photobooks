import { stripProcessGitEnv } from '@albasov/ts-agent-rig/strip-git-env'

stripProcessGitEnv()
// check.mjs may set these on roadmap children only; never let a leaked parent
// env change how roadmap.mjs / check tests behave vs plain CI `test:coverage`.
delete process.env.PHOTOBOOKS_CHECK_INNER
delete process.env.CHECK_VERBOSE
