import nightly from './stryker.config.mjs'
import { loadGates } from './scripts/load-gates.mjs'

const gates = loadGates()

/** Diff mutation config: nightly mutate/reporters + stricter thresholds. */
const config = {
  ...nightly,
  thresholds: gates.stryker.diffThresholds,
}

export default config
