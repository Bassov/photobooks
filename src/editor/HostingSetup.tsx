import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { createCfApi, type CfApi } from '../publish/cfApi'
import {
  discover,
  runSetup,
  setupTemplateUrl,
  type Discovery,
  type RowState,
  type SetupPlan,
  type SetupRow,
} from '../publish/provision'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { Icon } from '../ui/Icon'
import { LoaderGlyph } from './export/exportSiteGlyphs'
import { CheckingLabel, Fail, Swap } from './hostingBits'
import { BOX, CARD, ERR, GHOST, MODE_LINK, ring } from './hostingStyles'
import {
  PENDING_PROGRESS,
  SETUP_MESSAGES,
  addressView,
  applyRowState,
  failedRow,
  setupRowTexts,
  setupTarget,
  setupTokenState,
  subdomainError,
  tidySubdomain,
  type ProgressView,
  type RowView,
} from './hostingSetupModel'

/* Settings → Hosting guided setup (Designer Spec connect-own-hosting C1–C10, kit demo-parts/hostingSetup.tsx). The
   setup token input is uncontrolled: Continue reads it once into `createCfApi`, whose closure is the only place the
   token lives; the component keeps that client in a ref and drops it on step-1 Change, mode switch, unmount and
   success. */

const STEP = 'flex min-h-13 items-center gap-4 px-4 py-2'
const BODY = 'pl-13 pr-4 pb-3.5' // 52 = 16 + 20 + 16
const LABEL = 'mb-1.5 block text-sm leading-[19.5px] text-foreground'
const HINT = 'mt-1 text-xs leading-[16.8px] text-muted-foreground'
const FOOT = 'mt-3.5 flex items-center gap-4 @max-[480px]:flex-wrap'
const NOTE = 'min-w-0 flex-1 text-xs leading-[16.8px] text-muted-foreground'
const BTNS = 'flex shrink-0 gap-2 @max-[480px]:ml-auto'
const LINK_BTN =
  'inline-flex h-(--control-sm) items-center gap-1.5 rounded-md bg-field px-3 text-sm font-medium text-foreground no-underline shadow-xs hover:bg-[#CFCFCF]'
const TEXT_LINK =
  'inline-flex items-center gap-1 text-xs text-foreground underline decoration-foreground/35 underline-offset-4'
const SELECT =
  'h-8 min-w-0 appearance-none truncate rounded-md border-0 bg-field pr-8 pl-2.5 [font-family:inherit] text-sm text-foreground shadow-xs outline-none focus-visible:shadow-none focus-visible:ring-1 focus-visible:ring-[#535152] focus-visible:ring-inset'
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23535152' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`
const SELECT_STYLE = {
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  backgroundSize: '16px 16px',
}
const DASH = 'https://dash.cloudflare.com/?to=/:account'

function Ext({
  href,
  children,
  testId,
}: {
  href: string
  children: ReactNode
  testId?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_BTN}
      data-testid={testId}
    >
      {children}
      <Icon name="externalLink" size={14} />
    </a>
  )
}

type Mark = 'current' | 'done' | 'future'

function Marker({ n, mark }: { n: number; mark: Mark }) {
  return (
    <span
      data-testid={`hosting-marker-${String(n)}`}
      data-state={mark}
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full text-2xs font-semibold tabular-nums',
        mark === 'current' && 'bg-[#232223] text-[#F2F2F2]',
        mark === 'done' && 'bg-[#D7D7D7] text-[#393738] [&_svg]:stroke-[2.5]',
        mark === 'future' && 'text-[#535152]',
      )}
      style={
        mark === 'future'
          ? { boxShadow: 'inset 0 0 0 1px rgb(57 55 56 / .35)' }
          : undefined
      }
    >
      {mark === 'done' ? <Icon name="check" size={12} /> : n}
    </span>
  )
}

function StepHead({
  n,
  step,
  title,
  doneTitle,
  summary,
  onChange,
}: {
  n: 1 | 2 | 3
  step: 1 | 2 | 3
  title: string
  doneTitle: string
  summary: ReactNode
  onChange?: (() => void) | undefined
}) {
  const mark: Mark = n === step ? 'current' : n < step ? 'done' : 'future'
  return (
    <div
      className={STEP}
      data-testid={`hosting-step-${String(n)}`}
      aria-current={mark === 'current' ? 'step' : undefined}
    >
      <Marker n={n} mark={mark} />
      <div
        className={cn(
          'min-w-0 flex-1 text-sm',
          mark === 'future'
            ? 'text-muted-foreground'
            : 'font-medium text-foreground',
        )}
      >
        {mark === 'done' ? doneTitle : title}
      </div>
      {mark === 'done' && (
        <span
          className="max-w-1/2 truncate font-mono text-xs leading-[16.8px] text-muted-foreground"
          data-testid={`hosting-step-${String(n)}-summary`}
        >
          {summary}
        </span>
      )}
      {mark === 'done' && onChange !== undefined && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-medium text-foreground data-[hovered]:bg-[#CFCFCF]!"
          onPress={onChange}
          data-testid={`hosting-step-${String(n)}-change`}
        >
          Change
        </Button>
      )}
    </div>
  )
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="mt-1 rounded-lg bg-[rgb(57_55_56/.06)] px-3 py-2.5"
      data-testid="hosting-setup-box"
    >
      <div className="text-sm text-foreground">{title}</div>
      {children}
    </div>
  )
}

function RowIcon({ row }: { row: RowView }) {
  if (row === 'running') {
    return (
      <span className="grid size-4 shrink-0 place-items-center">
        <LoaderGlyph size={16} />
      </span>
    )
  }
  if (row === 'done') return <Icon name="check" size={16} />
  if (row === 'failed') return <Icon name="warning" size={16} />
  if (row === 'warn') {
    return <Icon name="warning" size={16} className="text-warning" />
  }
  return (
    <span className="grid size-4 shrink-0 place-items-center">
      <span className="size-1.5 rounded-full bg-[rgb(57_55_56/.35)]" />
    </span>
  )
}

interface StepOneFailure {
  message: string
  /** The token field rings red. */
  token: boolean
}

const TOKEN_FAILURES: readonly string[] = [
  'token-rejected',
  'missing-permission',
  'no-account',
]

export function HostingSetup({
  rule,
  focus,
  onDone,
  onManual,
}: {
  rule: () => ReactNode
  /** Focus the setup token (after Forget). */
  focus: boolean
  /** The record is stored. */
  onDone: () => Promise<void>
  onManual: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [checking, setChecking] = useState(false)
  const [tokenState, setTokenState] = useState<'' | 'ok' | 'bad'>('')
  const [failure, setFailure] = useState<StepOneFailure | undefined>()
  const [r2Off, setR2Off] = useState(false)
  const [discovery, setDiscovery] = useState<Discovery | undefined>()
  const [accountId, setAccountId] = useState('')
  const [sub, setSub] = useState('books')
  const [zone, setZone] = useState('')
  const [progress, setProgress] = useState<ProgressView>(PENDING_PROGRESS)
  /** `runSetup` is going: no Change, no mode link, no buttons. */
  const [running, setRunning] = useState(false)
  const tokenRef = useRef<HTMLInputElement>(null)
  const api = useRef<CfApi | null>(null)
  const plan = useRef<SetupPlan | null>(null)
  const run = useRef<AbortController | null>(null)
  /** Bumped by every reset: late answers of an older round are dropped. */
  const round = useRef(0)

  const reset = () => {
    round.current += 1
    run.current?.abort()
    run.current = null
    api.current = null
    plan.current = null
    if (tokenRef.current !== null) tokenRef.current.value = ''
    setStep(1)
    setChecking(false)
    setTokenState('')
    setFailure(undefined)
    setR2Off(false)
    setProgress(PENDING_PROGRESS)
    setRunning(false)
  }

  useEffect(
    () => () => {
      // Leaving Settings cancels setup after the current call (C8).
      round.current += 1
      run.current?.abort()
      api.current = null
      plan.current = null
    },
    [],
  )

  useEffect(() => {
    if (!focus) return
    const id = requestAnimationFrame(() => {
      tokenRef.current?.focus()
    })
    return () => {
      cancelAnimationFrame(id)
    }
  }, [focus])

  const view =
    discovery === undefined ? undefined : addressView(discovery, accountId)
  const zones = view?.active ?? []
  const zoneNow = zones.find((z) => z.name === zone) ?? zones[0]
  const subError = subdomainError(sub)
  const target =
    discovery === undefined || zoneNow === undefined
      ? undefined
      : setupTarget(discovery, accountId, sub, zoneNow.name)
  const canRun = target !== undefined && subError === undefined
  const failedAt = step === 3 && !running ? failedRow(progress) : undefined

  const tokenInput = (event: ChangeEvent<HTMLInputElement>) => {
    setTokenState(setupTokenState(event.target.value))
    setFailure(undefined)
  }

  /** Continue (reads the token) or Check again (the client kept in memory). */
  const check = async (again: boolean) => {
    if (checking) return
    if (!again) {
      const token = tokenRef.current?.value.trim() ?? ''
      if (setupTokenState(token) !== 'ok') return
      api.current = createCfApi(token, {})
    }
    const client = api.current
    if (client === null) return
    const mine = round.current
    setChecking(true)
    setFailure(undefined)
    const found = await discover(client)
    if (mine !== round.current) return
    setChecking(false)
    if (!found.ok) {
      // A failed Check again keeps its box (R2 off / no domain) and shows the error there.
      setFailure({
        message: found.message,
        token: TOKEN_FAILURES.includes(found.code),
      })
      return
    }
    setDiscovery(found)
    setAccountId((prev) =>
      found.accounts.some((account) => account.id === prev)
        ? prev
        : found.defaultAccountId,
    )
    if (step === 1 && !found.r2On) {
      setR2Off(true)
      return
    }
    setR2Off(false)
    if (tokenRef.current !== null) tokenRef.current.value = ''
    setTokenState('')
    setStep(2)
  }

  /** Set up from `from`; Try again passes the failed row and keeps the plan (C8). */
  const start = async (from: SetupRow) => {
    const client = api.current
    if (client === null || discovery === undefined || running) return
    if (from === 1) {
      if (zoneNow === undefined || target === undefined || !canRun) return
      plan.current = {
        api: client,
        tokenId: discovery.tokenId,
        bucketWriteGroupId: discovery.bucketWriteGroupId,
        accountId,
        zone: zoneNow,
        host: target.host,
        bucket: target.bucket,
        origin: location.origin,
        memory: {},
      }
      setProgress(PENDING_PROGRESS)
    }
    const current = plan.current
    if (current === null) return
    const controller = new AbortController()
    run.current = controller
    const mine = round.current
    setStep(3)
    setRunning(true)
    let last: RowState | undefined
    for await (const state of runSetup(current, from, {
      signal: controller.signal,
    })) {
      if (mine !== round.current) return
      last = state
      setProgress((prev) => applyRowState(prev, state))
    }
    if (mine !== round.current || controller.signal.aborted) return
    run.current = null
    setRunning(false)
    if (last?.row === 6 && last.state !== 'failed') {
      api.current = null
      plan.current = null
      await onDone()
    }
  }

  const toStep2 = () => {
    round.current += 1
    run.current?.abort()
    run.current = null
    plan.current = null
    setProgress(PENDING_PROGRESS)
    setRunning(false)
    setStep(2)
  }

  const account = discovery?.accounts.find((a) => a.id === accountId)
  const rowTexts =
    target === undefined ? [] : setupRowTexts(target.bucket, target.host)

  return (
    <div className="@container">
      <div
        className={CARD}
        data-testid="hosting-setup"
        aria-busy={checking || running || undefined}
      >
        <StepHead
          n={1}
          step={step}
          title="Connect your Cloudflare account"
          doneTitle="Cloudflare account"
          summary={account?.name}
          onChange={step === 2 ? reset : undefined}
        />
        {step === 1 && (
          <div className={BODY}>
            {r2Off ? (
              <Box title="R2 is off in this account.">
                <div className={HINT}>
                  Turn it on in Cloudflare. It asks for a card; the free tier
                  holds about 25 books (10 GB).
                </div>
                <div className="mt-2.5 flex gap-2">
                  <Ext href={`${DASH}/r2/overview`}>Turn on R2</Ext>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={GHOST}
                    onPress={() => {
                      void check(true)
                    }}
                    data-testid="hosting-setup-recheck"
                  >
                    <Swap
                      on={checking}
                      rest="Check again"
                      busy={<CheckingLabel />}
                    />
                  </Button>
                </div>
                {failure !== undefined && (
                  <div className="mt-2.5">
                    <Fail>{failure.message}</Fail>
                  </div>
                )}
              </Box>
            ) : (
              <>
                <p className="m-0 text-sm leading-[19.5px] text-muted-foreground">
                  Create a setup token in Cloudflare. The link fills in the
                  three permissions Photobooks needs. Setup deletes the token
                  when it ends.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Ext
                    href={setupTemplateUrl()}
                    testId="hosting-setup-template"
                  >
                    Create a setup token
                  </Ext>
                  <a
                    href="https://dash.cloudflare.com/sign-up"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={TEXT_LINK}
                    data-testid="hosting-setup-signup"
                  >
                    No Cloudflare account? Sign up
                    <Icon name="externalLink" size={12} />
                  </a>
                </div>
                <div className="mt-3.5">
                  <label htmlFor="hosting-setup-token-input" className={LABEL}>
                    Setup token
                  </label>
                  <div
                    className={cn(
                      BOX,
                      ring(tokenState === 'bad' || failure?.token === true),
                    )}
                  >
                    <input
                      ref={tokenRef}
                      id="hosting-setup-token-input"
                      type="password"
                      data-testid="hosting-setup-token"
                      placeholder="Paste the token"
                      autoComplete="off"
                      spellCheck={false}
                      autoCapitalize="off"
                      readOnly={checking}
                      aria-invalid={
                        tokenState === 'bad' || failure?.token === true
                          ? true
                          : undefined
                      }
                      aria-describedby="hosting-setup-token-line"
                      onChange={tokenInput}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void check(false)
                      }}
                      className={cn(
                        'min-w-0 flex-1 border-0 bg-transparent p-0 font-mono! text-sm outline-none placeholder:text-muted-foreground',
                        checking && 'text-muted-foreground',
                      )}
                    />
                  </div>
                  <div
                    id="hosting-setup-token-line"
                    className={HINT}
                    style={tokenState === 'bad' ? { color: ERR } : undefined}
                  >
                    {tokenState === 'bad'
                      ? SETUP_MESSAGES.token
                      : 'Permissions: Workers R2 Storage · Edit, Zone · Read, API Tokens · Edit.'}
                  </div>
                </div>
                <div className={FOOT}>
                  {failure === undefined ? (
                    <div className={NOTE}>
                      Sent to Cloudflare through Photobooks. Never stored.
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <Fail>{failure.message}</Fail>
                    </div>
                  )}
                  <div className={BTNS}>
                    <Button
                      size="sm"
                      className="px-3 text-sm"
                      isDisabled={tokenState !== 'ok' && !checking}
                      onPress={() => {
                        void check(false)
                      }}
                      data-testid="hosting-setup-continue"
                    >
                      <Swap
                        on={checking}
                        rest="Continue"
                        busy={<CheckingLabel />}
                      />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {rule()}
        <StepHead
          n={2}
          step={step}
          title="Choose the site address"
          doneTitle="Site address"
          summary={target?.host}
          onChange={failedAt !== undefined ? toStep2 : undefined}
        />
        {step === 2 && discovery !== undefined && (
          <div className={BODY}>
            {discovery.accounts.length > 1 && (
              <div className="mb-3.5">
                <label htmlFor="hosting-setup-account" className={LABEL}>
                  Account
                </label>
                <select
                  id="hosting-setup-account"
                  data-testid="hosting-setup-account"
                  value={accountId}
                  onChange={(event) => {
                    setAccountId(event.target.value)
                  }}
                  className={cn(SELECT, 'w-full')}
                  style={SELECT_STYLE}
                >
                  {discovery.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {zones.length === 0 ? (
              <Box title="This account has no active domain yet.">
                <div className={HINT}>
                  Your site needs a domain on Cloudflare. Add one you own, or
                  buy one in Cloudflare. When it shows Active, check again.
                </div>
                {view !== undefined && view.pending.length > 0 && (
                  <div className={HINT} data-testid="hosting-setup-pending">
                    Waiting for nameservers:{' '}
                    <span className="font-mono">{view.pending.join(', ')}</span>{' '}
                    (can take up to 24 hours)
                  </div>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Ext href={`${DASH}/add-site`}>Add a domain</Ext>
                  <Ext href={`${DASH}/domains/register`}>Buy a domain</Ext>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={GHOST}
                    onPress={() => {
                      void check(true)
                    }}
                    data-testid="hosting-setup-recheck"
                  >
                    <Swap
                      on={checking}
                      rest="Check again"
                      busy={<CheckingLabel />}
                    />
                  </Button>
                </div>
                {failure !== undefined && (
                  <div className="mt-2.5">
                    <Fail>{failure.message}</Fail>
                  </div>
                )}
              </Box>
            ) : (
              <>
                <label htmlFor="hosting-setup-sub-input" className={LABEL}>
                  Site address
                </label>
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      BOX,
                      'w-[140px] shrink-0 @max-[704px]:w-28',
                      ring(subError !== undefined),
                    )}
                  >
                    <input
                      id="hosting-setup-sub-input"
                      data-testid="hosting-setup-sub"
                      value={sub}
                      autoComplete="off"
                      spellCheck={false}
                      autoCapitalize="off"
                      aria-invalid={subError === undefined ? undefined : true}
                      aria-describedby="hosting-setup-sub-line"
                      onChange={(event) => {
                        setSub(tidySubdomain(event.target.value))
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void start(1)
                      }}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono! text-sm outline-none"
                    />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">
                    .
                  </span>
                  <select
                    aria-label="Domain"
                    data-testid="hosting-setup-zone"
                    value={zoneNow?.name}
                    onChange={(event) => {
                      setZone(event.target.value)
                    }}
                    className={cn(SELECT, 'flex-1')}
                    style={SELECT_STYLE}
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  id="hosting-setup-sub-line"
                  className={HINT}
                  style={subError === undefined ? undefined : { color: ERR }}
                  data-testid="hosting-setup-host"
                >
                  {subError ?? (
                    <>
                      Your site:{' '}
                      <span className="text-foreground">
                        https://{target?.host}
                      </span>
                      . Leave the first part empty to use {zoneNow?.name}{' '}
                      itself.
                    </>
                  )}
                </div>
                {target !== undefined && (
                  <div
                    className={cn(HINT, 'mt-2')}
                    data-testid="hosting-setup-bucket"
                  >
                    Storage:{' '}
                    {target.reused ? 'existing R2 bucket ' : 'new R2 bucket '}
                    <span className="font-mono">{target.bucket}</span>
                    {target.reused ? ' (reused)' : ''}
                  </div>
                )}
              </>
            )}
            <div className={FOOT}>
              <div className={NOTE}>
                Nothing changes in Cloudflare until you press Set up.
              </div>
              <div className={BTNS}>
                <Button
                  size="sm"
                  className="px-3 text-sm"
                  isDisabled={!canRun}
                  onPress={() => {
                    void start(1)
                  }}
                  data-testid="hosting-setup-run"
                >
                  Set up hosting
                </Button>
              </div>
            </div>
          </div>
        )}
        {rule()}
        <StepHead
          n={3}
          step={step}
          title="Set up"
          doneTitle="Set up"
          summary={null}
        />
        {step === 3 && (
          <div className={BODY}>
            <ol
              className="m-0 list-none p-0"
              data-testid="hosting-setup-progress"
            >
              {rowTexts.map((text, i) => {
                const row = progress.rows[i] ?? 'pending'
                return (
                  <li
                    key={i}
                    data-testid={`hosting-setup-row-${String(i + 1)}`}
                    data-state={row}
                  >
                    <div
                      className={cn(
                        'flex min-h-7 items-center gap-2 text-sm',
                        row === 'pending'
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                      )}
                      style={row === 'failed' ? { color: ERR } : undefined}
                    >
                      <RowIcon row={row} />
                      <span
                        data-testid={`hosting-setup-row-${String(i + 1)}-text`}
                      >
                        {text}
                      </span>
                    </div>
                    {row === 'failed' && progress.message !== undefined && (
                      <div
                        role="alert"
                        className="pb-1.5 pl-6 text-xs leading-[16.8px]"
                        style={{ color: ERR }}
                        data-testid="hosting-setup-row-error"
                      >
                        {progress.message}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            <div className={FOOT}>
              {failedAt === undefined ? (
                <div className={NOTE}>
                  Keep this page open. It takes about a minute.
                </div>
              ) : (
                <>
                  <div className={NOTE}>
                    Done steps are kept. Try again goes on from the failed one.
                  </div>
                  <div className={BTNS}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={GHOST}
                      onPress={toStep2}
                      data-testid="hosting-setup-cancel"
                    >
                      Cancel setup
                    </Button>
                    <Button
                      size="sm"
                      className="px-3 text-sm"
                      onPress={() => {
                        void start(failedAt)
                      }}
                      data-testid="hosting-setup-retry"
                    >
                      Try again
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {!running && (
        <button
          type="button"
          className={MODE_LINK}
          onClick={() => {
            // Leaving setup drops the token and any discovery (by design).
            reset()
            onManual()
          }}
          data-testid="hosting-manual"
        >
          Already have a bucket? Enter R2 keys yourself
        </button>
      )}
    </div>
  )
}
