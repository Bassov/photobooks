import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import {
  connectHosting,
  recheckHosting,
  type CheckResult,
} from '../publish/hosting'
import {
  forgetCredentials,
  loadHostingSummary,
  type HostingSummary,
} from '../publish/credentials'
import { AlertDialog } from '../ui/AlertDialog'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { Icon } from '../ui/Icon'
import { LoaderGlyph } from './export/exportSiteGlyphs'
import './export/ExportSiteButton.css'
import {
  HOSTING_MESSAGES,
  hostingFieldError,
  normaliseSiteAddress,
  setHostingField,
  validateHostingForm,
  type HostingField,
} from './hostingForm'
import { hostingCheckedWhen } from './settingsScreenModel'

/* Settings → Hosting (Designer Spec publish-credentials, kit demo-parts/hosting.tsx). The secret input is uncontrolled:
   its value is never in React state or a DOM attribute, and after Connect the UI reads only `loadHostingSummary`. */

/** Kit error red (printProfiles.tsx ERR); the prod status tokens are grey. */
const ERR = '#a8403a'
/* BOX / ring: the PrintProfileDialog field (private there). */
const BOX =
  'flex h-8 items-center rounded-md bg-field px-2.5 text-sm text-foreground'
function ring(error: boolean): string {
  return error
    ? 'shadow-none ring-1 ring-inset ring-[#a8403a]'
    : 'shadow-xs has-[input:focus-visible]:shadow-none has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-inset has-[input:focus-visible]:ring-[#535152]'
}
const FOOT = 'flex min-h-13 items-center gap-4 px-4 py-2.5'
const GHOST = 'px-3 text-sm'
const OUTLINE = 'px-3 text-sm shadow-xs'
const EYEBROW = 'mt-6 flex h-8 max-w-[640px] items-center justify-between px-4'
const EYEBROW_T =
  'm-0 text-2xs font-semibold uppercase tracking-[.12em] text-muted-foreground'
const CARD = 'mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome'

type Failure = Extract<CheckResult, { ok: false }>
/** The four echoed fields; the secret never enters React state. */
type Values = Record<Exclude<HostingField, 'secretAccessKey'>, string>

const EMPTY_VALUES: Values = {
  accountId: '',
  bucket: '',
  accessKeyId: '',
  publicBaseUrl: '',
}

/** `setHostingField` on the echoed fields (trim, endpoint URL → id + bucket). */
function setValue(values: Values, field: keyof Values, raw: string): Values {
  const next = setHostingField({ ...values, secretAccessKey: '' }, field, raw)
  return {
    accountId: next.accountId,
    bucket: next.bucket,
    accessKeyId: next.accessKeyId,
    publicBaseUrl: next.publicBaseUrl,
  }
}

const FIELDS: readonly {
  field: HostingField
  label: string
  testId: string
  placeholder: string
  hint?: string
}[] = [
  {
    field: 'accountId',
    label: 'Account ID',
    testId: 'hosting-account',
    placeholder: 'e.g. 0f3a9c…  (32 characters)',
    hint: 'R2 → Overview → Account Details. The S3 endpoint URL works too.',
  },
  {
    field: 'bucket',
    label: 'Bucket',
    testId: 'hosting-bucket',
    placeholder: 'my-photobooks',
  },
  {
    field: 'accessKeyId',
    label: 'Access key ID',
    testId: 'hosting-key',
    placeholder: '32 characters',
  },
  {
    field: 'secretAccessKey',
    label: 'Secret access key',
    testId: 'hosting-secret',
    placeholder: '64 characters',
    hint: 'Shown once by Cloudflare. Photobooks never shows it again.',
  },
  {
    field: 'publicBaseUrl',
    label: 'Site address',
    testId: 'hosting-url',
    placeholder: 'https://books.example.com',
    hint: 'The custom domain connected to this bucket.',
  },
]

/** Both labels sit in one grid cell, so the button keeps its width (the D36 Share rule). */
function Swap({
  on,
  rest,
  busy,
}: {
  on: boolean
  rest: ReactNode
  busy: ReactNode
}) {
  return (
    <span className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <span
        className={cn(
          'flex items-center justify-center gap-1.5',
          on && 'invisible',
        )}
      >
        {rest}
      </span>
      <span
        className={cn(
          'flex items-center justify-center gap-1.5',
          !on && 'invisible',
        )}
      >
        {busy}
      </span>
    </span>
  )
}

const checkingLabel = (
  <>
    <span className="grid size-3.5 place-items-center [&_svg]:size-3.5">
      <LoaderGlyph size={16} />
    </span>
    Checking…
  </>
)

function Fail({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex gap-2 text-sm"
      style={{ color: ERR }}
      role="alert"
      data-testid="hosting-error"
    >
      <Icon name="warning" size={16} className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export function HostingSection({
  row,
  rule,
}: {
  row: string
  rule: () => ReactNode
}) {
  /** `undefined` while the summary loads. */
  const [summary, setSummary] = useState<HostingSummary | null | undefined>()
  /** Stored values to prefill while replacing the token; `null` otherwise. */
  const [replace, setReplace] = useState<Values | null>(null)
  const [forgetOpen, setForgetOpen] = useState(false)
  const [focus, setFocus] = useState<HostingField | undefined>()

  const reload = useCallback(async () => {
    setSummary(await loadHostingSummary())
  }, [])

  useEffect(() => {
    void loadHostingSummary()
      .catch(() => null)
      .then(setSummary)
  }, [])

  if (summary === undefined) return <Intro />

  return (
    <>
      <Intro />
      {summary !== null && replace === null ? (
        <Connected
          summary={summary}
          row={row}
          rule={rule}
          onChanged={reload}
          onForget={() => {
            setForgetOpen(true)
          }}
          onReplace={() => {
            setFocus('accessKeyId')
            setReplace({
              accountId: summary.accountId,
              bucket: summary.bucket,
              accessKeyId: '',
              publicBaseUrl: summary.publicBaseUrl,
            })
          }}
        />
      ) : (
        <HostingForm
          row={row}
          rule={rule}
          initial={replace ?? EMPTY_VALUES}
          focus={focus}
          onSaved={async () => {
            await reload()
            setReplace(null)
          }}
          onCancel={
            replace
              ? () => {
                  setReplace(null)
                }
              : undefined
          }
        />
      )}
      <AlertDialog
        isOpen={forgetOpen}
        tone="destructive"
        icon={<Icon name="delete" size={16} />}
        title="Forget the hosting token?"
        confirmLabel="Forget token"
        onCancel={() => {
          setForgetOpen(false)
        }}
        onConfirm={() => {
          setForgetOpen(false)
          // Forget lives on the card, so the form mounts fresh and empty.
          void forgetCredentials().then(() => {
            setFocus('accountId')
            setSummary(null)
          })
        }}
      >
        Photobooks deletes the token from this computer. Your published site
        stays online. To publish again, paste a token. The token still works in
        Cloudflare: delete it there if you no longer need it.
      </AlertDialog>
    </>
  )
}

function Intro() {
  return (
    <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
      Publish uploads your books to your own Cloudflare R2 bucket. Paste a
      bucket token once: it stays on this computer and is sent only to
      Cloudflare.
    </p>
  )
}

/* ------------------------------------------------------------ form (not connected, and Replace) */

function HostingForm({
  row,
  rule,
  initial,
  focus,
  onSaved,
  onCancel,
}: {
  row: string
  rule: () => ReactNode
  initial: Values
  focus: HostingField | undefined
  onSaved: () => Promise<void>
  /** Replace only. */
  onCancel: (() => void) | undefined
}) {
  const [values, setValues] = useState<Values>(initial)
  // The secret's validity only: the value stays in the uncontrolled input.
  const [secret, setSecret] = useState<'' | 'ok' | 'bad'>('')
  const [checking, setChecking] = useState(false)
  const [failure, setFailure] = useState<Failure | undefined>()
  const secretRef = useRef<HTMLInputElement>(null)
  const inputs = useRef<Partial<Record<HostingField, HTMLInputElement | null>>>(
    {},
  )

  useEffect(() => {
    if (focus === undefined) return
    // After the dialog / card swap settles (focus restore runs on unmount).
    const id = requestAnimationFrame(() => {
      inputs.current[focus]?.focus()
    })
    return () => {
      cancelAnimationFrame(id)
    }
  }, [focus])

  const errors: Record<HostingField, string | undefined> = {
    accountId: hostingFieldError('accountId', values.accountId),
    bucket: hostingFieldError('bucket', values.bucket),
    accessKeyId: hostingFieldError('accessKeyId', values.accessKeyId),
    secretAccessKey:
      secret === 'bad' ? HOSTING_MESSAGES.secretAccessKey : undefined,
    publicBaseUrl: hostingFieldError('publicBaseUrl', values.publicBaseUrl),
  }
  const valid =
    secret === 'ok' &&
    (Object.keys(values) as (keyof Values)[]).every(
      (name) => values[name] !== '' && errors[name] === undefined,
    )
  const rings = failure?.fields ?? []

  const change = (
    field: keyof Values,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = event.target.value
    const pasted =
      (event.nativeEvent as InputEvent).inputType === 'insertFromPaste'
    // A typed endpoint URL is parsed on blur, a pasted one at once (D2).
    setValues((prev) =>
      field === 'accountId' && !pasted
        ? { ...prev, accountId: raw.trim() }
        : setValue(prev, field, raw),
    )
  }

  const blur: Partial<Record<keyof Values, () => void>> = {
    accountId: () => {
      setValues((prev) => setValue(prev, 'accountId', prev.accountId))
    },
    publicBaseUrl: () => {
      setValues((prev) => ({
        ...prev,
        publicBaseUrl: normaliseSiteAddress(prev.publicBaseUrl),
      }))
    },
  }

  const secretChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const trimmed = input.value.trim()
    // Same-value writes leave the caret alone.
    input.value = trimmed
    setSecret(
      trimmed === ''
        ? ''
        : hostingFieldError('secretAccessKey', trimmed) === undefined
          ? 'ok'
          : 'bad',
    )
  }

  const connect = async () => {
    if (!valid || checking) return
    const checked = validateHostingForm({
      ...values,
      secretAccessKey: secretRef.current?.value ?? '',
    })
    if (!checked.ok) return
    setFailure(undefined)
    setChecking(true)
    const result = await connectHosting(checked.value).catch((): Failure => ({
      ok: false,
      code: 'other',
      message:
        "Photobooks couldn't store the token on this computer. Try again.",
      fields: [],
    }))
    if (!result.ok) {
      setChecking(false)
      setFailure(result)
      return
    }
    if (secretRef.current !== null) secretRef.current.value = ''
    setSecret('')
    await onSaved()
  }

  const field = ({
    field: name,
    label,
    testId,
    placeholder,
    hint,
  }: (typeof FIELDS)[number]) => {
    const error = errors[name]
    const line = error ?? hint
    const id = `${testId}-input`
    const lineId = `${testId}-line`
    const common = {
      id,
      'data-testid': testId,
      placeholder,
      readOnly: checking,
      autoComplete: 'off',
      spellCheck: false,
      autoCapitalize: 'off',
      'aria-invalid': error === undefined ? undefined : true,
      'aria-describedby': line === undefined ? undefined : lineId,
      ref: (element: HTMLInputElement | null) => {
        inputs.current[name] = element
        if (name === 'secretAccessKey') secretRef.current = element
      },
      className: cn(
        'min-w-0 flex-1 border-0 bg-transparent p-0 font-mono! text-sm outline-none placeholder:text-muted-foreground',
        checking && 'text-muted-foreground',
      ),
    }
    return (
      <div className={row} data-testid={`${testId}-row`}>
        <label htmlFor={id} className="w-[160px] shrink-0 text-sm">
          {label}
        </label>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              BOX,
              ring(error !== undefined || rings.includes(name)),
            )}
          >
            {name === 'secretAccessKey' ? (
              <input type="password" onChange={secretChange} {...common} />
            ) : (
              <input
                value={values[name]}
                inputMode={name === 'publicBaseUrl' ? 'url' : undefined}
                onChange={(event) => {
                  change(name, event)
                }}
                onBlur={blur[name]}
                {...common}
              />
            )}
          </div>
          {line !== undefined && (
            <div
              id={lineId}
              className={cn(
                'mt-1 text-xs leading-[16.8px]',
                error === undefined && 'text-muted-foreground',
              )}
              style={error === undefined ? undefined : { color: ERR }}
            >
              {line}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={CARD}
        data-testid="hosting-form"
        aria-busy={checking || undefined}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            event.target instanceof HTMLInputElement
          ) {
            void connect()
          }
        }}
      >
        {FIELDS.map((entry, index) => (
          <Fragment key={entry.field}>
            {index > 0 && rule()}
            {field(entry)}
          </Fragment>
        ))}
        {rule()}
        <div className={FOOT}>
          <div className="min-w-0 flex-1">
            {failure === undefined ? (
              <div className="text-xs leading-[16.8px] text-muted-foreground">
                Stored only on this computer. Sent only to Cloudflare.
              </div>
            ) : (
              <Fail>{failure.message}</Fail>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {onCancel !== undefined && (
              <Button
                variant="ghost"
                size="sm"
                className={GHOST}
                isDisabled={checking}
                onPress={onCancel}
                data-testid="hosting-cancel"
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              className="px-3 text-sm"
              isDisabled={!valid && !checking}
              onPress={() => {
                void connect()
              }}
              data-testid="hosting-connect"
            >
              <Swap on={checking} rest="Connect" busy={checkingLabel} />
            </Button>
          </div>
        </div>
      </div>
      <Help cors={failure?.code === 'cors'} />
    </>
  )
}

/* ------------------------------------------------------------ help (not connected, and Replace) */

function corsPolicy(origin: string): string {
  return `[{
  "AllowedOrigins": ["${origin}"],
  "AllowedMethods": ["GET", "HEAD", "PUT", "DELETE"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]`
}

function B({ children }: { children: ReactNode }) {
  return <b className="font-medium text-foreground">{children}</b>
}

function Help({ cors }: { cors: boolean }) {
  const [copied, setCopied] = useState(false)
  const policy = corsPolicy(location.origin)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => {
      setCopied(false)
    }, 2000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [copied])
  const steps: ReactNode[] = [
    <>
      In Cloudflare, open <B>R2 → Overview</B> and create a bucket. Copy the{' '}
      <B>Account ID</B> from Account Details.
    </>,
    <>
      In the bucket, <B>Settings → Custom Domains → Connect Domain</B>. That
      address is your <B>Site address</B>.
    </>,
    <>
      In <B>Settings → CORS Policy → Add CORS policy</B>, paste this on the JSON
      tab:
      <div className="relative mt-1.5">
        <pre
          className="m-0 overflow-x-auto whitespace-pre rounded-md bg-field py-2 pl-3 pr-16 font-mono text-xs leading-[18px] text-foreground"
          data-testid="hosting-cors-json"
        >
          {policy}
        </pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-7 px-2 text-xs"
          onPress={() => {
            // `navigator.clipboard` is missing outside secure contexts.
            void Promise.resolve()
              .then(() => navigator.clipboard.writeText(policy))
              .catch(() => undefined)
            setCopied(true)
          }}
          data-testid="hosting-cors-copy"
        >
          <Swap on={copied} rest="Copy" busy="Copied" />
        </Button>
      </div>
    </>,
    <>
      In <B>R2 → Overview → API Tokens → Manage</B>, create an{' '}
      <B>Account API token</B>: <B>Object Read & Write</B>, for this bucket
      only.
    </>,
    <>
      Paste the <B>Access Key ID</B> and <B>Secret Access Key</B> above.
      Cloudflare shows the secret only once.
    </>,
  ]
  return (
    <>
      <div className={EYEBROW}>
        <h2 className={EYEBROW_T}>How to get a token</h2>
      </div>
      <div
        className="mt-2 max-w-[640px] rounded-xl bg-chrome px-4 pt-3 pb-3.5"
        data-testid="hosting-help"
      >
        <ol className="m-0 list-none p-0">
          {steps.map((step, index) => {
            const marked = cors && index === 2
            return (
              <li
                key={index}
                className="-mx-2 grid grid-cols-[20px_1fr] rounded-lg px-2 py-1 text-sm text-muted-foreground"
                style={
                  marked ? { background: 'rgb(57 55 56 / 0.06)' } : undefined
                }
                data-testid={`hosting-step-${String(index + 1)}`}
                data-marked={marked ? '' : undefined}
              >
                <span className="font-medium tabular-nums text-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">{step}</div>
              </li>
            )
          })}
        </ol>
        <a
          className="mt-1 inline-flex items-center gap-1 pl-5 text-xs text-foreground underline decoration-foreground/35 underline-offset-4"
          href="https://developers.cloudflare.com/r2/api/tokens/"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="hosting-docs"
        >
          Cloudflare R2 tokens
          <Icon name="externalLink" size={14} className="size-3" />
        </a>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ connected */

function Connected({
  summary,
  row,
  rule,
  onChanged,
  onForget,
  onReplace,
}: {
  summary: HostingSummary
  row: string
  rule: () => ReactNode
  onChanged: () => Promise<void>
  onForget: () => void
  onReplace: () => void
}) {
  const [checking, setChecking] = useState(false)
  const { status } = summary

  const recheck = async () => {
    if (checking) return
    setChecking(true)
    await recheckHosting().catch(() => null)
    await onChanged()
    setChecking(false)
  }

  const mono = (label: string, value: ReactNode, testId: string) => (
    <>
      <div className={row}>
        <div className="min-w-0 flex-1 text-sm">{label}</div>
        <span
          className="font-mono text-xs text-muted-foreground"
          data-testid={testId}
        >
          {value}
        </span>
      </div>
      {rule()}
    </>
  )

  return (
    <div
      className={CARD}
      data-testid="hosting-connected"
      aria-busy={checking || undefined}
    >
      <div className={row}>
        <div className="min-w-0 flex-1 text-sm">
          Connection
          {status !== null && (
            <div
              className="text-xs text-muted-foreground"
              data-testid="hosting-checked"
            >
              {status.ok ? 'Checked' : 'Last check failed'}{' '}
              {hostingCheckedWhen(status.checkedAtMs, new Date())}
            </div>
          )}
        </div>
        {status !== null &&
          (status.ok ? (
            <Badge color="success" dot data-testid="hosting-badge">
              Connected
            </Badge>
          ) : (
            <Badge color="error" dot data-testid="hosting-badge">
              Can't connect
            </Badge>
          ))}
      </div>
      {status !== null && !status.ok && (
        <div className="px-4 pb-2">
          <Fail>{status.message}</Fail>
        </div>
      )}
      {rule()}
      <div className={row}>
        <div className="min-w-0 flex-1 text-sm">Site address</div>
        <a
          href={summary.publicBaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="hosting-site"
          className="inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-4"
          style={{ textDecorationColor: 'rgb(57 55 56 / 0.35)' }}
        >
          {new URL(summary.publicBaseUrl).host}
          <Icon name="externalLink" size={14} className="size-3.5" />
        </a>
      </div>
      {rule()}
      {mono('Bucket', summary.bucket, 'hosting-stored-bucket')}
      {mono('Account ID', summary.accountId, 'hosting-stored-account')}
      {mono('Access key ID', `…${summary.accessKeyTail}`, 'hosting-stored-key')}
      <div className={row}>
        <div className="min-w-0 flex-1 text-sm">Secret access key</div>
        <span
          role="img"
          aria-label="Stored, hidden"
          className="font-mono text-xs text-muted-foreground"
          data-testid="hosting-stored-secret"
        >
          ••••••••••••
        </span>
      </div>
      {rule()}
      <div className={FOOT}>
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className={GHOST}
            onPress={onForget}
            data-testid="hosting-forget"
          >
            Forget token…
          </Button>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className={OUTLINE}
            onPress={() => {
              void recheck()
            }}
            data-testid="hosting-recheck"
          >
            <Swap on={checking} rest="Check again" busy={checkingLabel} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={OUTLINE}
            isDisabled={checking}
            onPress={onReplace}
            data-testid="hosting-replace"
          >
            Replace token…
          </Button>
        </div>
      </div>
    </div>
  )
}
