// npm run demo:baseline [outdir] — capture the #/demo walk (needs a fresh `npm run build`).
import { capture } from "./demo-capture.mjs"
const out = process.argv[2] ?? "/workspace/research/uikit-decompose/baseline"
const { shots, errs } = await capture(out)
console.log(`${shots.length} steps → ${out}`, errs.length ? `\npage errors: ${errs.join(" | ")}` : "")
