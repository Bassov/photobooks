import { useState, type ReactNode } from 'react'
import { spineWidthMm, type PrintProfile } from '../core'
import { Button } from '../ui/Button'
import { cx } from '../ui/className'
import { Dialog, DialogTitle } from '../ui/Dialog'
import {
  draftIssues,
  fromDraft,
  isTableSpine,
  savableProfile,
  toDraft,
  type DraftKey,
  type DraftNumber,
  type ProfileDraft,
} from './printProfileDraft'

/** Kit error red (printProfiles.tsx ERR); the prod status tokens are grey. */
const ERR = '#a8403a'
const BOX =
  'flex h-8 items-center rounded-md bg-field px-2.5 text-sm text-foreground'
const INPUT =
  'min-w-0 flex-1 border-0 bg-transparent p-0 outline-none [font:inherit]'
const GROUP =
  'col-span-2 mt-3 text-2xs font-semibold uppercase leading-[14.84px] tracking-[.12em] text-muted-foreground'

/** Kit Field rule: shadow-xs at rest; focus and error are a 1 px inset ring. */
function ring(error: boolean): string {
  return error
    ? 'shadow-none ring-1 ring-inset ring-[#a8403a]'
    : 'shadow-xs has-[input:focus-visible]:shadow-none has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-inset has-[input:focus-visible]:ring-[#535152]'
}

const LABELS: Record<DraftNumber, string> = {
  trimMin: 'Smallest page side',
  trimMax: 'Largest page side',
  bleed: 'Bleed',
  safe: 'Safe margin',
  pMin: 'Fewest pages',
  pMax: 'Most pages',
  pStep: 'Page step',
  spineBase: 'Spine base',
  spinePer: 'Spine per page',
  wrap: 'Cover wrap',
  hinge: 'Cover hinge',
  dpiWarn: 'Warn under',
  dpiMin: 'Minimum',
}

/**
 * Designer spec printer-presets §Profile editor: "new" is not listed until
 * Save; "edit" changes a custom profile that books follow.
 */
export function PrintProfileDialog({
  profile,
  mode,
  onSave,
  onCancel,
}: {
  profile: PrintProfile
  mode: 'new' | 'edit'
  onSave: (profile: PrintProfile) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(profile))
  const issues = draftIssues(profile, draft)
  const savable = savableProfile(profile, draft)
  const save = () => {
    if (savable !== undefined) {
      onSave(savable)
    }
  }
  const field = (key: DraftNumber, unit?: string, width = 96) => (
    <label
      className={cx(BOX, 'shrink-0 gap-1.5', ring(issues[key] !== undefined))}
      style={{ width }}
      data-testid={`pp-${key}`}
    >
      <input
        aria-label={LABELS[key]}
        aria-invalid={issues[key] === undefined ? undefined : true}
        inputMode="decimal"
        value={draft[key]}
        onChange={(event) => {
          setDraft({ ...draft, [key]: event.target.value })
        }}
        // `!`: INPUT's `[font:inherit]` shorthand otherwise resets the family.
        className={cx(INPUT, 'font-mono! tabular-nums')}
      />
      {unit === undefined ? null : (
        <span className="shrink-0 text-muted-foreground">{unit}</span>
      )}
    </label>
  )
  const message = (...keys: DraftKey[]) => {
    const text = keys.map((key) => issues[key]).find(Boolean)
    return text === undefined ? null : (
      <div
        className="col-start-2 -mt-0.5 text-xs leading-[16.8px]"
        style={{ color: ERR }}
        data-testid="pp-error"
      >
        {text}
      </div>
    )
  }
  const row = (label: string, control: ReactNode, ...keys: DraftKey[]) => (
    <>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
        {control}
      </div>
      {message(...keys)}
    </>
  )
  const table = isTableSpine(profile)
  const pagesOk = [
    issues.pMin,
    issues.pMax,
    issues.pStep,
    issues.spineBase,
    issues.spinePer,
  ].every((issue) => issue === undefined)
  const [pMin, pMax] = [Number(draft.pMin), Number(draft.pMax)]
  const spine = fromDraft(profile, draft).spine.width
  const width = (pages: number) =>
    String(spineWidthMm(spine, pages, { min: pMin, max: pMax }))
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
      className="pb-print-profile-dialog"
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        data-testid="print-profile-dialog"
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (event.target as HTMLElement).tagName === 'INPUT'
          ) {
            event.preventDefault()
            save()
          }
        }}
      >
        <DialogTitle className="heading">
          {mode === 'new' ? 'New print profile' : 'Edit print profile'}
        </DialogTitle>
        <p
          className="mb-0 mt-1 text-sm text-muted-foreground"
          data-testid="pp-sub"
        >
          Based on {profile.basedOn ?? profile.name}.
          {mode === 'edit'
            ? ' Books that use this profile follow your changes.'
            : null}
        </p>
        <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-auto px-1">
          <div
            className="grid grid-cols-[132px_1fr] items-center gap-x-3 gap-y-2"
            data-testid="pp-form"
          >
            <div className="text-sm text-muted-foreground">Name</div>
            <label
              className={cx(BOX, 'w-full', ring(issues.name !== undefined))}
              data-testid="pp-name"
            >
              <input
                aria-label="Name"
                aria-invalid={issues.name === undefined ? undefined : true}
                value={draft.name}
                onChange={(event) => {
                  setDraft({ ...draft, name: event.target.value })
                }}
                className={INPUT}
              />
            </label>
            {message('name')}
            <div className={GROUP}>Page</div>
            {row(
              'Page side',
              <>
                {field('trimMin', 'mm')}to{field('trimMax', 'mm')}
              </>,
              'trimMin',
              'trimMax',
            )}
            {row('Bleed', field('bleed', 'mm'), 'bleed')}
            {row('Safe margin', field('safe', 'mm'), 'safe')}
            <div className={GROUP}>Pages</div>
            {row(
              'Page count',
              <>
                {field('pMin')}to{field('pMax')}in steps of
                {field('pStep', undefined, 64)}
              </>,
              'pMin',
              'pMax',
              'pStep',
            )}
            <div className={GROUP}>Spine and cover</div>
            {table
              ? row(
                  'Spine',
                  <span
                    className="text-foreground"
                    data-testid="pp-spine-table"
                  >
                    From the {profile.basedOn ?? profile.name} table ·{' '}
                    {pagesOk ? `${width(pMin)}–${width(pMax)}` : '–'} mm
                  </span>,
                )
              : row(
                  'Spine',
                  <>
                    {field('spineBase', 'mm')}+{field('spinePer', 'mm')}per page
                  </>,
                  'spineBase',
                  'spinePer',
                )}
            {!table && pagesOk ? (
              <div
                className="col-start-2 -mt-0.5 text-xs leading-[16.8px] text-muted-foreground"
                data-testid="pp-spine-hint"
              >
                {pMin} pages = {width(pMin)} mm · {pMax} pages = {width(pMax)}{' '}
                mm
              </div>
            ) : null}
            {row(
              'Wrap · hinge',
              <>
                {field('wrap', 'mm')}
                {field('hinge', 'mm')}
              </>,
              'wrap',
              'hinge',
            )}
            <div className={GROUP}>Photo quality</div>
            {row('Warn under', field('dpiWarn', 'ppi'), 'dpiWarn')}
            {row('Minimum', field('dpiMin', 'ppi'), 'dpiMin')}
          </div>
        </div>
        <div className="mt-5 flex shrink-0 justify-end gap-2">
          <Button variant="ghost" size="md" className="px-4" onPress={onCancel}>
            Cancel
          </Button>
          <Button
            size="md"
            className="px-4"
            isDisabled={savable === undefined}
            onPress={save}
            data-testid="pp-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
