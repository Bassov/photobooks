/* Settings → Hosting, guided setup (Designer Spec connect-own-hosting C1–C10): a setup token → the site address → Set up.
   Kit: Cloudflare is simulated (Continue 900 ms, each row 600 ms) and nothing goes to the network. Tokens starting with
   `r2off` / `nozone` / `noperm` pick those states; subdomain `taken` fails row 3, `keep` leaves the setup token (C10).
   The token input is uncontrolled: Continue reads it once into a ref, never into React state or a DOM attribute. */
import * as React from "react"
import { Check, ExternalLink, Loader2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BOX, CHEVRON, ERR, ring } from "./printProfiles"
import { Fail, GHOST, OUTLINE, Swap, checkingLabel } from "./hostingBits"
import type { HostingRecord } from "./session"

/** feature-page seed: a state the card is frozen at (no timer runs until the user acts) */
export type SetupSeed = "checking" | "r2off" | "address" | "nozone" | "running" | "failed"
type Disc = { account: string; zones: string[]; pending: string[]; buckets: string[] }
type Row = "pending" | "running" | "done" | "failed" | "warn"

/* ---------------------------------------------------------------- rules and the simulated Cloudflare */
const TOKEN = /^[A-Za-z0-9_-]{40,200}$/
const SUB = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const TEMPLATE = `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${encodeURIComponent(JSON.stringify([
  { key: "workers_r2", type: "edit" }, { key: "zone", type: "read" }, { key: "api_tokens", type: "edit" }]))}&accountId=*&zoneId=all&name=Photobooks%20setup`
const DASH = "https://dash.cloudflare.com/?to=/:account"
const SEED_TOKEN = (p = "kit") => `${p}${"a".repeat(40)}`
/** C7: `pb-` + the host, dots → hyphens, ≤ 63, no trailing hyphen */
export const bucketNameFor = (host: string) => `pb-${host.toLowerCase().replace(/\./g, "-")}`.slice(0, 63).replace(/-+$/, "")
const BASOV: Disc = { account: "Aleksandr Basov", zones: ["basov.photo", "example.com"], pending: [], buckets: ["pb-family-basov-photo"] }
const NOZONE: Disc = { account: "Mira’s account", zones: [], pending: ["mybooks.org"], buckets: [] }
/* Check again (`again`) pretends the user fixed it in Cloudflare: R2 is on, the pending zone is active */
function discover(token: string, again: boolean): { disc?: Disc; r2off?: boolean; err?: string } {
  if (token.startsWith("noperm")) return { err: "This token is missing API Tokens · Edit. Create it again from the link above." }
  if (token.startsWith("r2off") && !again) return { r2off: true }
  if (token.startsWith("nozone")) return { disc: again ? { ...NOZONE, zones: NOZONE.pending, pending: [] } : NOZONE }
  return { disc: BASOV }
}
const ROWS = (bucket: string, host: string) => [`Create the bucket ${bucket}`, "Allow uploads from Photobooks", `Connect ${host}`,
  "Create a key for this bucket only", "Test an upload", "Delete the setup token"]
const PENDING: Row[] = Array(6).fill("pending")
const dnsMessage = (host: string) => `${host} already points somewhere else in your DNS. Choose another address, or delete that record in Cloudflare.`

/* ---------------------------------------------------------------- bits */
const STEP = "flex min-h-13 items-center gap-4 px-4 py-2"
const BODY = "pl-13 pr-4 pb-3.5" // 52 = 16 + 20 + 16
const LABEL = "mb-1.5 block text-sm leading-[19.5px] text-foreground"
const HINT = "mt-1 text-xs leading-[16.8px] text-muted-foreground"
const FOOT = "mt-3.5 flex items-center gap-4 @max-[480px]:flex-wrap"
const NOTE = "min-w-0 flex-1 text-xs leading-[16.8px] text-muted-foreground"
const BTNS = "flex shrink-0 gap-2 @max-[480px]:ml-auto"
const LINK_BTN = "inline-flex h-(--control-sm) items-center gap-1.5 rounded-md bg-field px-3 text-sm font-medium text-foreground shadow-xs hover:bg-[#CFCFCF]"
const Ext = ({ href, children, tid }: { href: string; children: React.ReactNode; tid?: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_BTN} data-testid={tid}>{children}<ExternalLink className="size-3.5" /></a>
)
type Mark = "current" | "done" | "future"
function Marker({ n, s }: { n: number; s: Mark }) {
  return (
    <span data-testid={`hosting-marker-${n}`} data-state={s} className={cn("grid size-5 shrink-0 place-items-center rounded-full text-2xs font-semibold tabular-nums",
      s === "current" && "bg-[#232223] text-[#F2F2F2]", s === "done" && "bg-[#D7D7D7] text-[#393738]", s === "future" && "text-[#535152]")}
      style={s === "future" ? { boxShadow: "inset 0 0 0 1px rgb(57 55 56 / .35)" } : undefined}>
      {s === "done" ? <Check className="size-3" strokeWidth={2.5} /> : n}
    </span>
  )
}
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-1 rounded-lg bg-[rgb(57_55_56/.06)] px-3 py-2.5" data-testid="hosting-setup-box"><div className="text-sm text-foreground">{title}</div>{children}</div>
}
function RowIcon({ s }: { s: Row }) {
  if (s === "running") return <Loader2 className="size-4 shrink-0 animate-spin text-foreground motion-reduce:animate-none" />
  if (s === "done") return <Check className="size-4 shrink-0 text-foreground" />
  if (s === "failed") return <TriangleAlert className="size-4 shrink-0" />
  if (s === "warn") return <TriangleAlert className="size-4 shrink-0 text-warning" />
  return <span className="grid size-4 shrink-0 place-items-center"><span className="size-1.5 rounded-full bg-[rgb(57_55_56/.35)]" /></span>
}

/* ---------------------------------------------------------------- card */
export function HostingSetup({ rule, seed, active, focus, onDone, onManual }: {
  rule: React.ReactNode; seed?: SetupSeed; active: boolean; focus?: boolean; onDone: (r: HostingRecord) => void; onManual: () => void
}) {
  const at3 = seed === "running" || seed === "failed"
  const [step, setStep] = React.useState<1 | 2 | 3>(at3 ? 3 : seed === "address" || seed === "nozone" ? 2 : 1)
  const [checking, setChecking] = React.useState(seed === "checking")
  const [tokenOk, setTokenOk] = React.useState(seed === "checking")
  const [tokenBad, setTokenBad] = React.useState(false)
  const [fail, setFail] = React.useState<string>()
  const [r2off, setR2off] = React.useState(seed === "r2off")
  const [disc, setDisc] = React.useState<Disc | undefined>(seed === "nozone" ? NOZONE : seed && seed !== "checking" && seed !== "r2off" ? BASOV : undefined)
  const [sub, setSub] = React.useState("books")
  const [zone, setZone] = React.useState(BASOV.zones[0])
  const [rows, setRows] = React.useState<Row[]>(seed === "running" ? ["done", "done", "running", ...PENDING.slice(3)] : seed === "failed" ? ["done", "done", "failed", ...PENDING.slice(3)] : PENDING)
  const [rowFail, setRowFail] = React.useState<string | undefined>(seed === "failed" ? dnsMessage("books.basov.photo") : undefined)
  const tokenRef = React.useRef<HTMLInputElement>(null)
  const mem = React.useRef<string | null>(seed && seed !== "checking" ? SEED_TOKEN(seed === "r2off" || seed === "nozone" ? seed : "kit") : null)
  const timer = React.useRef(0)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  React.useEffect(() => { if (seed === "checking" && tokenRef.current) tokenRef.current.value = SEED_TOKEN() }, [])
  React.useEffect(() => { if (!focus) return; const id = requestAnimationFrame(() => tokenRef.current?.focus()); return () => cancelAnimationFrame(id) }, [focus])
  const running = step === 3 && rows.includes("running")
  /* leaving setup mode loses the token (by design); the typed address stays */
  const reset = () => {
    window.clearTimeout(timer.current); mem.current = null
    if (tokenRef.current) tokenRef.current.value = ""
    setStep(1); setChecking(false); setTokenOk(false); setTokenBad(false); setFail(undefined); setR2off(false); setRows(PENDING); setRowFail(undefined)
  }
  React.useEffect(() => { if (!active) reset() }, [active])

  const zones = disc?.zones ?? []
  const zoneNow = zones.includes(zone) ? zone : zones[0] ?? ""
  const subBad = !!sub && !SUB.test(sub)
  const host = sub ? `${sub}.${zoneNow}` : zoneNow
  const bucket = bucketNameFor(host)
  const canRun = !!zoneNow && !subBad

  const tokenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value.trim()
    setTokenOk(TOKEN.test(t)); setTokenBad(!!t && !TOKEN.test(t)); setFail(undefined)
  }
  /* Continue / Check again: the token is read once (Continue) and then kept only in the ref */
  const check = (again: boolean) => {
    if (checking) return
    if (!again) {
      const t = tokenRef.current?.value.trim() ?? ""
      if (!TOKEN.test(t)) return
      mem.current = t
    }
    setChecking(true); setFail(undefined)
    timer.current = window.setTimeout(() => {
      setChecking(false)
      const r = discover(mem.current ?? "", again)
      setR2off(!!r.r2off)
      if (r.err) { setFail(r.err); return }
      if (r.disc) { setDisc(r.disc); setStep(2); if (tokenRef.current) tokenRef.current.value = "" }
    }, 900)
  }
  const recheckZones = () => {
    if (checking) return
    setChecking(true)
    timer.current = window.setTimeout(() => { setChecking(false); setDisc(discover(mem.current ?? "", true).disc) }, 900)
  }
  /* Set up: rows from `from` on, 600 ms each; done rows are never re-run (C8) */
  const run = (from: number) => {
    if (!canRun) return
    setStep(3); setRowFail(undefined)
    const tick = (i: number) => {
      setRows((p) => p.map((s, k) => (k === i ? "running" : k < i ? s : "pending")))
      timer.current = window.setTimeout(() => {
        if (i === 2 && sub === "taken") { setRows((p) => p.map((s, k) => (k === i ? "failed" : s))); setRowFail(dnsMessage(host)); return }
        setRows((p) => p.map((s, k) => (k === i ? (i === 5 && sub === "keep" ? "warn" : "done") : s)))
        if (i < 5) { tick(i + 1); return }
        const now = Date.now()
        mem.current = null
        onDone({ accountId: "0f3a9c51e2b74d0a8c66f1e9d3b241c2", bucket, accessKeyTail: "7d1e", publicBaseUrl: `https://${host}`, checkedAtMs: now, ok: true,
          origin: "setup", provisionedAtMs: now, setupTokenLeft: sub === "keep" || undefined })
      }, 600)
    }
    tick(from)
  }
  const toStep2 = () => { window.clearTimeout(timer.current); setRows(PENDING); setRowFail(undefined); setStep(2) }

  const head = (n: 1 | 2 | 3, title: string, doneTitle: string, summary: React.ReactNode, onChange?: () => void) => {
    const s: Mark = n === step ? "current" : n < step ? "done" : "future"
    return (
      <div className={STEP} data-testid={`hosting-step-${n}`} aria-current={s === "current" ? "step" : undefined}>
        <Marker n={n} s={s} />
        <div className={cn("min-w-0 flex-1 text-sm", s === "future" ? "text-muted-foreground" : "font-medium text-foreground")}>{s === "done" ? doneTitle : title}</div>
        {s === "done" && <span className="max-w-1/2 truncate font-mono text-xs leading-[16.8px] text-muted-foreground" data-testid={`hosting-step-${n}-summary`}>{summary}</span>}
        {s === "done" && onChange && <Button variant="ghost" size="xs" className="px-2 text-xs data-[hovered]:bg-[#CFCFCF]" onPress={onChange} data-testid={`hosting-step-${n}-change`}>Change</Button>}
      </div>
    )
  }
  const failed = rows.includes("failed")
  /* as the manual Connect: the busy loader while Checking… is the Spec's only icon on a primary button */
  const continueLabel = <Swap on={checking} rest="Continue" busy={checkingLabel} />
  const rowTexts = ROWS(bucket, host)
  return (
    <>
      <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="hosting-setup" aria-busy={checking || running || undefined}>
        {head(1, "Connect your Cloudflare account", "Cloudflare account", disc?.account, step === 2 ? reset : undefined)}
        {step === 1 && (
          <div className={BODY}>
            {r2off ? (
              <Box title="R2 is off in this account.">
                <div className={HINT}>Turn it on in Cloudflare. It asks for a card; the free tier holds about 25 books (10 GB).</div>
                <div className="mt-2.5 flex gap-2">
                  <Ext href={`${DASH}/r2/overview`}>Turn on R2</Ext>
                  <Button variant="ghost" size="sm" className={GHOST} onPress={() => check(true)} data-testid="hosting-setup-recheck"><Swap on={checking} rest="Check again" busy={checkingLabel} /></Button>
                </div>
              </Box>
            ) : (
              <>
                <p className="text-sm leading-[19.5px] text-muted-foreground">Create a setup token in Cloudflare. The link fills in the three permissions Photobooks needs. Setup deletes the token when it ends.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Ext href={TEMPLATE} tid="hosting-setup-template">Create a setup token</Ext>
                  <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-foreground underline decoration-foreground/35 underline-offset-4" data-testid="hosting-setup-signup">No Cloudflare account? Sign up<ExternalLink className="size-3" /></a>
                </div>
                <div className="mt-3.5">
                  <label htmlFor="hosting-setup-token-input" className={LABEL}>Setup token</label>
                  <div className={cn(BOX, ring(tokenBad || !!fail))}>
                    <input ref={tokenRef} id="hosting-setup-token-input" type="password" data-testid="hosting-setup-token" placeholder="Paste the token" autoComplete="off" spellCheck={false} autoCapitalize="off"
                      readOnly={checking} aria-invalid={tokenBad || !!fail || undefined} aria-describedby="hosting-setup-token-line" onChange={tokenInput}
                      onKeyDown={(e) => { if (e.key === "Enter") check(false) }}
                      className={cn("min-w-0 flex-1 border-0 bg-transparent p-0 font-mono! text-sm outline-none placeholder:text-muted-foreground", checking && "text-muted-foreground")} />
                  </div>
                  <div id="hosting-setup-token-line" className={cn(HINT, tokenBad && "text-[#a8403a]")}>{tokenBad ? "This doesn't look like a Cloudflare API token." : "Permissions: Workers R2 Storage · Edit, Zone · Read, API Tokens · Edit."}</div>
                </div>
                <div className={FOOT}>
                  {fail ? <div className="min-w-0 flex-1"><Fail>{fail}</Fail></div> : <div className={NOTE}>Sent to Cloudflare through Photobooks. Never stored.</div>}
                  <div className={BTNS}><Button size="sm" className="px-3 text-sm" isDisabled={!tokenOk && !checking} onPress={() => check(false)} data-testid="hosting-setup-continue">{continueLabel}</Button></div>
                </div>
              </>
            )}
          </div>
        )}
        {rule}
        {head(2, "Choose the site address", "Site address", host, step === 3 && failed ? toStep2 : undefined)}
        {step === 2 && (
          <div className={BODY}>
            {!zones.length ? (
              <Box title="This account has no active domain yet.">
                <div className={HINT}>Your site needs a domain on Cloudflare. Add one you own, or buy one in Cloudflare. When it shows Active, check again.</div>
                {disc && disc.pending.length > 0 && <div className={HINT}>Waiting for nameservers: <span className="font-mono">{disc.pending.join(", ")}</span> (can take up to 24 hours)</div>}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Ext href={`${DASH}/add-site`}>Add a domain</Ext>
                  <Ext href={`${DASH}/domains/register`}>Buy a domain</Ext>
                  <Button variant="ghost" size="sm" className={GHOST} onPress={recheckZones} data-testid="hosting-setup-recheck"><Swap on={checking} rest="Check again" busy={checkingLabel} /></Button>
                </div>
              </Box>
            ) : (
              <>
                <label htmlFor="hosting-setup-sub" className={LABEL}>Site address</label>
                <div className="flex items-center gap-1.5">
                  <div className={cn(BOX, "w-[140px] shrink-0 @max-[704px]:w-28", ring(subBad))}>
                    <input id="hosting-setup-sub" data-testid="hosting-setup-sub" value={sub} autoComplete="off" spellCheck={false} autoCapitalize="off" aria-invalid={subBad || undefined}
                      aria-describedby="hosting-setup-sub-line" onChange={(e) => setSub(e.target.value.trim().toLowerCase())} onKeyDown={(e) => { if (e.key === "Enter") run(0) }}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono! text-sm outline-none" />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">.</span>
                  <select aria-label="Domain" data-testid="hosting-setup-zone" value={zoneNow} onChange={(e) => setZone(e.target.value)}
                    className="h-8 min-w-0 flex-1 appearance-none truncate rounded-md border-0 bg-field pl-2.5 pr-8 text-sm text-foreground shadow-xs outline-none focus-visible:shadow-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#535152]"
                    style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "16px 16px" }}>
                    {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div id="hosting-setup-sub-line" className={cn(HINT, subBad && "text-[#a8403a]")} data-testid="hosting-setup-host">
                  {subBad ? "Use a–z, 0–9 and hyphens, like books." : <>Your site: <span className="text-foreground">https://{host}</span>. Leave the first part empty to use {zoneNow} itself.</>}
                </div>
                <div className={cn(HINT, "mt-2")} data-testid="hosting-setup-bucket">
                  Storage: {disc?.buckets.includes(bucket) ? <>existing R2 bucket <span className="font-mono">{bucket}</span> (reused)</> : <>new R2 bucket <span className="font-mono">{bucket}</span></>}
                </div>
              </>
            )}
            <div className={FOOT}>
              <div className={NOTE}>Nothing changes in Cloudflare until you press Set up.</div>
              <div className={BTNS}><Button size="sm" className="px-3 text-sm" isDisabled={!canRun} onPress={() => run(0)} data-testid="hosting-setup-run">Set up hosting</Button></div>
            </div>
          </div>
        )}
        {rule}
        {head(3, "Set up", "Set up", null)}
        {step === 3 && (
          <div className={BODY}>
            <ol data-testid="hosting-setup-progress">
              {rowTexts.map((t, i) => (
                <li key={i} data-testid={`hosting-setup-row-${i + 1}`} data-state={rows[i]}>
                  <div className={cn("flex min-h-7 items-center gap-2 text-sm", rows[i] === "pending" && "text-muted-foreground", rows[i] !== "pending" && rows[i] !== "failed" && "text-foreground")}
                    style={rows[i] === "failed" ? { color: ERR } : undefined}><RowIcon s={rows[i]} /><span data-testid={`hosting-setup-row-${i + 1}-text`}>{t}</span></div>
                  {rows[i] === "failed" && rowFail && <div role="alert" className="pb-1.5 pl-6 text-xs leading-[16.8px]" style={{ color: ERR }} data-testid="hosting-setup-row-error">{rowFail}</div>}
                </li>
              ))}
            </ol>
            <div className={FOOT}>
              {failed ? (
                <>
                  <div className={NOTE}>Done steps are kept. Try again goes on from the failed one.</div>
                  <div className={BTNS}>
                    <Button variant="ghost" size="sm" className={GHOST} onPress={toStep2} data-testid="hosting-setup-cancel">Cancel setup</Button>
                    <Button size="sm" className="px-3 text-sm" onPress={() => run(rows.indexOf("failed"))} data-testid="hosting-setup-retry">Try again</Button>
                  </div>
                </>
              ) : <div className={NOTE}>Keep this page open. It takes about a minute.</div>}
            </div>
          </div>
        )}
      </div>
      {!running && <button type="button" className="mt-3 pl-4 text-xs text-foreground underline decoration-foreground/35 underline-offset-4" onClick={onManual} data-testid="hosting-manual">Already have a bucket? Enter R2 keys yourself</button>}
    </>
  )
}
