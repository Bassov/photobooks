import { z } from 'zod'

// The editor's CSP has `script-src 'self'` (no eval). Zod's first parse probes
// `new Function`; the probe is caught, but a strict CSP still reports it as a
// violation. jitless skips the probe and uses the interpreted parser. The
// config is global, so entries (page and workers) import this module first.
z.config({ jitless: true })
