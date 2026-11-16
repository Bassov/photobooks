/* Settings → Hosting (Designer Specs publish-credentials, connect-own-hosting): the guided setup (hostingSetup.tsx, the
   default when not connected), the Cloudflare R2 entry form, the connected card, the help card and the forget confirm.
   Kit: the check is simulated (900 ms) and nothing goes to the network. The secret input is uncontrolled, so its value
   is never in React state or a DOM attribute; after Connect only the key's last 4 are kept. */
import * as React from "react"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/uui/Badge"
import { AlertDialog } from "@/components/app/ui"
import { BOX, ERR, ring } from "./printProfiles"
import { Fail, GHOST, OUTLINE, Swap, checkingLabel, when } from "./hostingBits"
import { HostingSetup, type SetupSeed } from "./hostingSetup"
import { useSession, type HostingCode, type HostingRecord } from "./session"

type Field = "account" | "bucket" | "key" | "secret" | "url"
type Mode = "setup" | "manual"
export type HostingDraft = Partial<Record<Field, string>>
/** feature-page seed: a typed draft, a check frozen at Checking…, a failed check, Replace open, the forget confirm open;
   `mode` opens the manual form, `setup` freezes the guided setup at a state */
export type HostingInit = { draft?: HostingDraft; checking?: boolean; fail?: HostingCode; replace?: boolean; forget?: boolean; mode?: Mode; setup?: SetupSeed }

/* ---------------------------------------------------------------- validation (Spec § Validation) */
const HEX32 = /^[0-9a-f]{32}$/i
const HEX64 = /^[0-9a-f]{64}$/i
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/
const ENDPOINT = /^https:\/\/([0-9a-f]{32})\.(?:(eu|fedramp)\.)?r2\.cloudflarestorage\.com(?:\/([^/?#]*))?\/?$/i
const MSG = {
  account: "The account ID is 32 characters, 0–9 and a–f.",
  jurisdiction: "Buckets with a jurisdiction (EU, FedRAMP) aren't supported yet.",
  bucket: "Bucket names are 3–63 characters: a–z, 0–9 and hyphens.",
  key: "The access key ID is 32 characters, 0–9 and a–f.",
  secret: "The secret is 64 characters, 0–9 and a–f.",
  http: "Use https://.",
  path: "Use the domain only, without a path.",
  r2dev: "Use the custom domain. The r2.dev address is for testing only.",
  url: "Enter a web address, like https://books.example.com.",
}
const accountError = (v: string) => {
  const m = ENDPOINT.exec(v)
  if (m) return m[2] ? MSG.jurisdiction : undefined
  return HEX32.test(v) ? undefined : MSG.account
}
/** The site address as stored (`https://host`), or its error. A bare host is taken as https. */
function site(v: string): { url?: string; err?: string } {
  if (/^http:/i.test(v)) return { err: MSG.http }
  let u: URL
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`) } catch { return { err: MSG.url } }
  if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return { err: MSG.url }
  if (u.pathname !== "/" || u.search || u.hash) return { err: MSG.path }
  if (u.hostname.endsWith(".r2.dev")) return { err: MSG.r2dev }
  return { url: `https://${u.host}` }
}
const errorOf = (f: Exclude<Field, "secret">, v: string) => !v ? undefined
  : f === "account" ? accountError(v) : f === "bucket" ? (BUCKET.test(v) ? undefined : MSG.bucket)
  : f === "key" ? (HEX32.test(v) ? undefined : MSG.key) : site(v).err

/* ---------------------------------------------------------------- check (simulated) and its messages */
const ZERO_KEY = "0".repeat(32)
/* Connect sees the full key; Check again sees only the stored tail, so "0000" is the rejected key there */
const simulate = (bucket: string, key: string): HostingCode | undefined =>
  bucket === "missing" ? "NoSuchBucket" : key === ZERO_KEY || key === "0000" ? "InvalidAccessKeyId" : undefined
const failMessage = (code: HostingCode, bucket: string, stored = false) => ({
  Offline: "You're offline. Connect to the internet and try again.",
  Cors: "Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.",
  InvalidAccessKeyId: stored ? "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token." : "Cloudflare doesn't recognise this key. Check the access key ID and secret.",
  AccessDenied: `This token can't write to “${bucket}”. Give it Object Read & Write on this bucket.`,
  NoSuchBucket: `There's no bucket “${bucket}” in this account.`,
  Timeout: "Cloudflare didn't answer in 15 seconds. Try again.",
})[code]
const RINGS: Partial<Record<HostingCode, Field[]>> = { InvalidAccessKeyId: ["key", "secret"], NoSuchBucket: ["account", "bucket"] }
/** Run `done` after the simulated 900 ms check; the timer dies with the component. */
function useCheck() {
  const [checking, setChecking] = React.useState(false)
  const timer = React.useRef(0)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  const run = (done: () => void) => { setChecking(true); timer.current = window.setTimeout(() => { setChecking(false); done() }, 900) }
  return [checking, run, setChecking] as const
}

/* ---------------------------------------------------------------- shared bits */
const ROW = "flex min-h-13 items-center gap-4 px-4 py-2"
const FOOT = "flex min-h-13 items-center gap-4 px-4 py-2.5"
const MODE_LINK = "mt-3 pl-4 text-xs text-foreground underline decoration-foreground/35 underline-offset-4"
const EYEBROW = "mt-6 flex h-8 max-w-[640px] items-center justify-between px-4"
const EYEBROW_T = "text-2xs font-semibold uppercase tracking-[.12em] text-muted-foreground"
const ORIGIN = "https://photobooks.photobooks-bassov.workers.dev"
const CORS = `[{
  "AllowedOrigins": ["${ORIGIN}"],
  "AllowedMethods": ["GET", "HEAD", "PUT", "DELETE"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]`
/* ---------------------------------------------------------------- section */
export function HostingSection({ rule, init = {} }: { rule: React.ReactNode; init?: HostingInit }) {
  const { set, useDemo } = useSession()
  const rec = useDemo().hosting
  const [replacing, setReplacing] = React.useState(!!init.replace && !!rec)
  const [forget, setForget] = React.useState(!!init.forget && !!rec)
  const [focus, setFocus] = React.useState<Field | "token" | undefined>(init.replace ? "key" : undefined)
  const [seed, setSeed] = React.useState(init) // a scenario seed is used once: after Connect or Forget the form starts empty
  const [mode, setMode] = React.useState<Mode>(init.mode ?? "setup")
  const [round, setRound] = React.useState(0) // remounts both modes after Connect / Set up / Forget
  const save = (r: HostingRecord) => { set({ hosting: r }); setReplacing(false); setSeed({}); setRound((n) => n + 1) }
  /* not connected: both modes stay mounted, so each keeps its typed values; the hidden one drops its secret / token */
  return (
    <>
      <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground" data-testid="settings-hosting-intro">Publish puts your books on your own site, in your own Cloudflare account. Set it up once: Photobooks keeps only a key for its own bucket, on this computer.</p>
      {rec && !replacing
        ? <Connected rec={rec} rule={rule} onForget={() => setForget(true)} onReplace={() => { setFocus("key"); setReplacing(true) }} onChecked={(r) => set({ hosting: r })} />
        : rec
          ? <HostingForm key="replace" rule={rule} init={{ draft: { account: rec.accountId, bucket: rec.bucket, url: rec.publicBaseUrl } }} focus={focus === "token" ? undefined : focus} active onSaved={save} onCancel={() => setReplacing(false)} />
          : <React.Fragment key={round}>
              <div hidden={mode !== "setup"}><HostingSetup rule={rule} seed={seed.setup} active={mode === "setup"} focus={focus === "token"} onDone={save} onManual={() => setMode("manual")} /></div>
              <div hidden={mode !== "manual"}><HostingForm rule={rule} init={seed} focus={focus === "token" ? undefined : focus} active={mode === "manual"} onSaved={(r) => save({ ...r, origin: "manual" })} onGuided={() => setMode("setup")} /></div>
            </React.Fragment>}
      <AlertDialog isOpen={forget} tone="destructive" title="Forget the hosting token?" confirmLabel="Forget token" onCancel={() => setForget(false)}
        onConfirm={() => { const back: Mode = rec?.origin === "setup" ? "setup" : "manual"; setForget(false); setReplacing(false); setMode(back); setFocus(back === "setup" ? "token" : "account"); setSeed({}); setRound((n) => n + 1); set({ hosting: null }) }}>
        Photobooks deletes the token from this computer. Your published site stays online. To publish again, paste a token. The token still works in Cloudflare: delete it there if you no longer need it.
      </AlertDialog>
    </>
  )
}

/* ---------------------------------------------------------------- form (not connected, and Replace) */
const FIELDS: [Field, string, string, string?][] = [
  ["account", "Account ID", "e.g. 0f3a9c…  (32 characters)", "R2 → Overview → Account Details. The S3 endpoint URL works too."],
  ["bucket", "Bucket", "my-photobooks"],
  ["key", "Access key ID", "32 characters"],
  ["secret", "Secret access key", "64 characters", "Shown once by Cloudflare. Photobooks never shows it again."],
  ["url", "Site address", "https://books.example.com", "The custom domain connected to this bucket."],
]
const TID: Record<Field, string> = { account: "hosting-account", bucket: "hosting-bucket", key: "hosting-key", secret: "hosting-secret", url: "hosting-url" }
type Values = Record<Exclude<Field, "secret">, string>
function HostingForm({ rule, init, focus, active, onSaved, onCancel, onGuided }: {
  rule: React.ReactNode; init: HostingInit; focus?: Field; active: boolean; onSaved: (r: HostingRecord) => void; onCancel?: () => void; onGuided?: () => void
}) {
  const d = init.draft ?? {}
  const [v, setV] = React.useState<Values>({ account: d.account ?? "", bucket: d.bucket ?? "", key: d.key ?? "", url: d.url ?? "" })
  const [secret, setSecret] = React.useState<"" | "ok" | "bad">(!d.secret ? "" : HEX64.test(d.secret) ? "ok" : "bad")
  const [fail, setFail] = React.useState<HostingCode | undefined>(init.fail)
  const [checking, run, setChecking] = useCheck()
  React.useEffect(() => { if (init.checking) setChecking(true) }, [])
  const secretRef = React.useRef<HTMLInputElement>(null)
  const refs = React.useRef<Partial<Record<Field, HTMLInputElement | null>>>({})
  React.useEffect(() => { if (d.secret && secretRef.current) secretRef.current.value = d.secret }, [])
  React.useEffect(() => { if (!focus) return; const id = requestAnimationFrame(() => refs.current[focus]?.focus()); return () => cancelAnimationFrame(id) }, [focus])
  /* leaving manual mode loses the secret (by design); the other fields stay */
  React.useEffect(() => { if (active || !secretRef.current) return; secretRef.current.value = ""; setSecret("") }, [active])
  const errs: Partial<Record<Field, string>> = { account: errorOf("account", v.account), bucket: errorOf("bucket", v.bucket), key: errorOf("key", v.key), secret: secret === "bad" ? MSG.secret : undefined, url: errorOf("url", v.url) }
  const valid = !!(v.account && v.bucket && v.key && v.url) && secret === "ok" && !Object.values(errs).some(Boolean)
  const rings = (fail && RINGS[fail]) || []
  /* the Spec's only icon on a primary button: the busy loader while Checking… (prod: the loader glyph) */
  const connectLabel = <Swap on={checking} rest="Connect" busy={checkingLabel} />
  /* the endpoint URL becomes the id (its bucket fills an empty Bucket); a hex id is lowercased */
  const tidyAccount = (raw: string, bucket = v.bucket) => {
    const m = ENDPOINT.exec(raw)
    if (m && !m[2]) return { account: m[1].toLowerCase(), bucket: bucket || m[3] || "" }
    return { account: HEX32.test(raw) ? raw.toLowerCase() : raw, bucket }
  }
  const change = (f: Exclude<Field, "secret">, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim()
    const pasted = (e.nativeEvent as InputEvent).inputType === "insertFromPaste"
    setV((p) => f === "account" && pasted ? { ...p, ...tidyAccount(raw, p.bucket) } : { ...p, [f]: raw })
  }
  const blur = (f: Exclude<Field, "secret">) => {
    if (f === "account") setV((p) => ({ ...p, ...tidyAccount(p.account, p.bucket) }))
    if (f === "url") setV((p) => { const s = p.url && site(p.url); return s && s.url ? { ...p, url: s.url } : p })
  }
  const secretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target, t = el.value.trim()
    if (t !== el.value) el.value = t
    setSecret(!t ? "" : HEX64.test(t) ? "ok" : "bad")
  }
  const connect = () => {
    if (!valid || checking) return
    const acc = tidyAccount(v.account), key = v.key.toLowerCase(), url = site(v.url).url!
    setFail(undefined)
    run(() => {
      const code = simulate(acc.bucket, key)
      if (code) { setFail(code); return }
      if (secretRef.current) secretRef.current.value = ""
      onSaved({ accountId: acc.account, bucket: acc.bucket, accessKeyTail: key.slice(-4), publicBaseUrl: url, checkedAtMs: Date.now(), ok: true })
    })
  }
  const field = ([f, label, ph, hint]: (typeof FIELDS)[number]) => {
    const err = errs[f], line = err ?? hint, id = `hosting-${f}-input`, lineId = `hosting-${f}-line`
    const common = {
      id, "data-testid": TID[f], placeholder: ph, readOnly: checking, autoComplete: "off", spellCheck: false, autoCapitalize: "off",
      "aria-invalid": !!err || undefined, "aria-describedby": line ? lineId : undefined,
      ref: (el: HTMLInputElement | null) => { refs.current[f] = el; if (f === "secret") secretRef.current = el },
      className: cn("min-w-0 flex-1 border-0 bg-transparent p-0 font-mono! text-sm outline-none placeholder:text-muted-foreground", checking && "text-muted-foreground"),
    }
    return (
      <div className={ROW} data-testid={`${TID[f]}-row`}>
        <label htmlFor={id} className="w-[160px] shrink-0 text-sm">{label}</label>
        <div className="min-w-0 flex-1">
          <div className={cn(BOX, ring(!!err || rings.includes(f)))}>
            {f === "secret"
              ? <input type="password" onChange={secretChange} {...common} />
              : <input value={v[f]} inputMode={f === "url" ? "url" : undefined} onChange={(e) => change(f, e)} onBlur={() => blur(f)} {...common} />}
          </div>
          {line && <div id={lineId} className={cn("mt-1 text-xs leading-[16.8px]", !err && "text-muted-foreground")} style={err ? { color: ERR } : undefined}>{line}</div>}
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="hosting-form" aria-busy={checking || undefined}
        onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) connect() }}>
        {FIELDS.map((x, i) => <React.Fragment key={x[0]}>{i > 0 && rule}{field(x)}</React.Fragment>)}
        {rule}
        <div className={FOOT}>
          <div className="min-w-0 flex-1">
            {fail ? <Fail>{failMessage(fail, v.bucket)}</Fail> : <div className="text-xs leading-[16.8px] text-muted-foreground">Stored only on this computer. Sent only to Cloudflare.</div>}
          </div>
          <div className="flex shrink-0 gap-2">
            {onCancel && <Button variant="ghost" size="sm" className={GHOST} onPress={onCancel} isDisabled={checking} data-testid="hosting-cancel">Cancel</Button>}
            <Button size="sm" className="px-3 text-sm" isDisabled={!valid && !checking} onPress={connect} data-testid="hosting-connect">{connectLabel}</Button>
          </div>
        </div>
      </div>
      {onGuided && <button type="button" className={MODE_LINK} onClick={onGuided} disabled={checking} data-testid="hosting-guided">Set up automatically instead</button>}
      <Help cors={fail === "Cors"} />
    </>
  )
}

/* ---------------------------------------------------------------- help (not connected, and Replace) */
const B = ({ children }: { children: React.ReactNode }) => <b className="font-medium text-foreground">{children}</b>
function Help({ cors }: { cors: boolean }) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => { if (!copied) return; const t = window.setTimeout(() => setCopied(false), 2000); return () => window.clearTimeout(t) }, [copied])
  const copy = () => { void navigator.clipboard?.writeText(CORS).catch(() => {}); setCopied(true) }
  const steps: React.ReactNode[] = [
    <>In Cloudflare, open <B>R2 → Overview</B> and create a bucket. Copy the <B>Account ID</B> from Account Details.</>,
    <>In the bucket, <B>Settings → Custom Domains → Connect Domain</B>. That address is your <B>Site address</B>.</>,
    <>In <B>Settings → CORS Policy → Add CORS policy</B>, paste this on the JSON tab:
      <div className="relative mt-1.5">
        <pre className="overflow-x-auto whitespace-pre rounded-md bg-field py-2 pl-3 pr-16 font-mono text-xs leading-[18px] text-foreground" data-testid="hosting-cors-json">{CORS}</pre>
        <Button variant="ghost" size="xs" className="absolute right-1 top-1 px-2 text-xs data-[hovered]:bg-accent" onPress={copy} data-testid="hosting-cors-copy"><Swap on={copied} rest="Copy" busy="Copied" /></Button>
      </div></>,
    <>In <B>R2 → Overview → API Tokens → Manage</B>, create an <B>Account API token</B>: <B>Object Read & Write</B>, for this bucket only.</>,
    <>Paste the <B>Access Key ID</B> and <B>Secret Access Key</B> above. Cloudflare shows the secret only once.</>,
  ]
  return (
    <>
      <div className={EYEBROW}><h2 className={EYEBROW_T}>How to get a token</h2></div>
      <div className="mt-2 max-w-[640px] rounded-xl bg-chrome px-4 pb-3.5 pt-3" data-testid="hosting-help">
        <ol>
          {steps.map((s, i) => (
            <li key={i} className="-mx-2 grid grid-cols-[20px_1fr] rounded-lg px-2 py-1 text-sm text-muted-foreground" style={cors && i === 2 ? { background: "rgb(57 55 56 / 0.06)" } : undefined}
              data-testid={`hosting-help-step-${i + 1}`} data-marked={cors && i === 2 ? "" : undefined}>
              <span className="font-medium tabular-nums text-foreground">{i + 1}</span><div className="min-w-0">{s}</div>
            </li>
          ))}
        </ol>
        <a className="mt-1 inline-flex items-center gap-1 pl-5 text-xs text-foreground underline decoration-foreground/35 underline-offset-4" href="https://developers.cloudflare.com/r2/api/tokens/" target="_blank" rel="noopener noreferrer" data-testid="hosting-docs">Cloudflare R2 tokens<ExternalLink className="size-3" /></a>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- connected */
function Connected({ rec, rule, onForget, onReplace, onChecked }: { rec: HostingRecord; rule: React.ReactNode; onForget: () => void; onReplace: () => void; onChecked: (r: HostingRecord) => void }) {
  const [checking, run] = useCheck()
  const recheck = () => { if (!checking) run(() => { const code = simulate(rec.bucket, rec.accessKeyTail); onChecked({ ...rec, checkedAtMs: Date.now(), ok: !code, code }) }) }
  /* connect-own-hosting: "Set up automatically" until the first Check again; "New address" for 15 min after setup */
  const setUp = rec.origin === "setup" && rec.checkedAtMs === rec.provisionedAtMs
  const fresh = !!rec.provisionedAtMs && Date.now() - rec.provisionedAtMs < 15 * 60_000
  const mono = (k: string, val: React.ReactNode, tid: string, extra?: React.HTMLAttributes<HTMLSpanElement>) => (
    <><div className={ROW}><div className="min-w-0 flex-1 text-sm">{k}</div><span className="font-mono text-xs text-muted-foreground" data-testid={tid} {...extra}>{val}</span></div>{rule}</>
  )
  return (
    <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="hosting-connected" aria-busy={checking || undefined}>
      <div className={ROW}>
        <div className="min-w-0 flex-1 text-sm">Connection<div className="text-xs text-muted-foreground" data-testid="hosting-checked">{setUp ? "Set up automatically" : rec.ok ? "Checked" : "Last check failed"} {when(rec.checkedAtMs)}</div></div>
        {rec.ok ? <Badge color="success" dot>Connected</Badge> : <Badge color="error" dot>Can't connect</Badge>}
      </div>
      {!rec.ok && rec.code && <div className="px-4 pb-2"><Fail>{failMessage(rec.code, rec.bucket, true)}</Fail></div>}
      {rec.setupTokenLeft && (
        <div className="px-4 pb-2 text-xs leading-[16.8px] text-muted-foreground" data-testid="hosting-token-left">
          Delete the “Photobooks setup” token in Cloudflare →{" "}
          <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground underline decoration-foreground/35 underline-offset-4">API Tokens<ExternalLink className="size-3" /></a>.
        </div>
      )}
      {rule}
      <div className={ROW}>
        <div className="min-w-0 flex-1 text-sm">Site address{fresh && <div className="text-xs text-muted-foreground" data-testid="hosting-site-new">New address: it can take a few minutes to start working.</div>}</div>
        <a href={rec.publicBaseUrl} target="_blank" rel="noopener noreferrer" data-testid="hosting-site" className="inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-4" style={{ textDecorationColor: "rgb(57 55 56 / 0.35)" }}>{new URL(rec.publicBaseUrl).host}<ExternalLink className="size-3.5" /></a>
      </div>
      {rule}
      {mono("Bucket", rec.bucket, "hosting-stored-bucket")}
      {mono("Account ID", rec.accountId, "hosting-stored-account")}
      {mono("Access key ID", `…${rec.accessKeyTail}`, "hosting-stored-key")}
      <div className={ROW}><div className="min-w-0 flex-1 text-sm">Secret access key</div><span role="img" aria-label="Stored, hidden" className="font-mono text-xs text-muted-foreground" data-testid="hosting-stored-secret">••••••••••••</span></div>
      {rule}
      <div className={FOOT}>
        <div className="min-w-0 flex-1"><Button variant="ghost" size="sm" className="px-3 text-sm data-[hovered]:bg-accent" onPress={onForget} data-testid="hosting-forget">Forget token…</Button></div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className={OUTLINE} onPress={recheck} data-testid="hosting-recheck"><Swap on={checking} rest="Check again" busy={checkingLabel} /></Button>
          <Button variant="outline" size="sm" className={OUTLINE} onPress={onReplace} isDisabled={checking} data-testid="hosting-replace">Replace token…</Button>
        </div>
      </div>
    </div>
  )
}
