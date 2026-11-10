import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  builtInPrintProfiles,
  profileSummary,
  type PrintProfile,
} from '../core'
import { AlertDialog } from '../ui/AlertDialog'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Menu, MenuItem, MenuPopover, MenuTrigger } from '../ui/Menu'
import { PrintProfileDialog } from './PrintProfileDialog'
import {
  deletePrintProfile,
  duplicatePrintProfile,
  getPrintProfilesState,
  newPrintProfile,
  savePrintProfile,
  setDefaultPrintProfileId,
  subscribePrintProfiles,
} from './printProfilesStore'

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23535152' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`
/** Kit settings.tsx SECONDARY on `outline`: --field rest, --accent hover. */
const SECONDARY = 'gap-1.5 px-3 text-sm shadow-xs [&_svg]:size-4'
const EYEBROW = 'mt-6 flex h-8 max-w-[640px] items-center justify-between px-4'
const EYEBROW_T =
  'm-0 text-2xs font-semibold uppercase tracking-[.12em] text-muted-foreground'
const PANEL = 'mt-2 max-w-[640px] overflow-hidden rounded-xl bg-chrome'
/** Kit Delete… red (settings.tsx); the prod destructive token is grey. */
const DELETE_RED = '#a8403a'

interface Editing {
  profile: PrintProfile
  mode: 'new' | 'edit'
}

/** Designer spec printer-presets §Settings: default, print shops, customs. */
export function PrintPresetsSection({
  row,
  rule,
}: {
  row: string
  rule: () => ReactNode
}) {
  const { customs, defaultId } = useSyncExternalStore(
    subscribePrintProfiles,
    getPrintProfilesState,
    getPrintProfilesState,
  )
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<PrintProfile | null>(null)
  const shops = builtInPrintProfiles()
  const duplicate = (profile: PrintProfile) => {
    const copy = duplicatePrintProfile(
      profile,
      [...shops, ...customs].map((p) => p.name),
    )
    setEditing({ profile: copy, mode: 'edit' })
  }
  const item = (profile: PrintProfile, testId: string, right: ReactNode) => {
    const summary = profileSummary(profile)
    return (
      <div className={row} data-testid={testId}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{profile.name}</div>
          <div
            className="truncate text-xs text-muted-foreground"
            title={summary}
            data-testid="print-summary-line"
          >
            {summary}
          </div>
        </div>
        {profile.id === defaultId ? <Badge color="gray">Default</Badge> : null}
        {right}
      </div>
    )
  }
  const list = (
    profiles: readonly PrintProfile[],
    render: (profile: PrintProfile) => ReactNode,
  ) =>
    profiles.map((profile, index) => (
      <Fragment key={profile.id}>
        {index > 0 ? rule() : null}
        {render(profile)}
      </Fragment>
    ))
  return (
    <>
      <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
        A print profile holds a printer’s rules: page sizes, bleed, safe margin,
        page count and spine. Each book uses one profile; new books start with
        the default.
      </p>
      <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome">
        <div className={row}>
          <div className="min-w-0 flex-1 text-sm">Default for new books</div>
          <select
            aria-label="Default for new books"
            data-testid="print-default"
            value={defaultId}
            onChange={(event) => {
              setDefaultPrintProfileId(event.target.value)
            }}
            className="h-8 w-[240px] shrink-0 appearance-none truncate rounded-md border-0 bg-field pr-8 pl-2.5 text-sm text-foreground outline-none [font:inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]"
            style={{
              width: 240,
              backgroundImage: CHEVRON,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '16px 16px',
            }}
          >
            <optgroup label="Print shops">
              {shops.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            {customs.length > 0 ? (
              <optgroup label="Custom">
                {customs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
      </div>
      <div className={EYEBROW}>
        <h2 className={EYEBROW_T}>Print shops</h2>
      </div>
      <div className={PANEL} data-testid="print-shops">
        {list(shops, (p) =>
          item(
            p,
            `print-shop-${p.id}`,
            <Button
              variant="outline"
              size="sm"
              className={SECONDARY}
              onPress={() => {
                duplicate(p)
              }}
              data-testid={`print-duplicate-${p.id}`}
            >
              Duplicate
            </Button>,
          ),
        )}
      </div>
      <div className={EYEBROW}>
        <h2 className={EYEBROW_T}>Custom</h2>
        <Button
          variant="outline"
          size="sm"
          className={SECONDARY}
          onPress={() => {
            setEditing({ profile: newPrintProfile(), mode: 'new' })
          }}
          data-testid="print-new"
        >
          <Icon name="plus" size={16} />
          New profile
        </Button>
      </div>
      <div className={PANEL} data-testid="print-custom">
        {customs.length === 0 ? (
          <div
            className={cn(row, 'text-sm text-muted-foreground')}
            data-testid="print-custom-empty"
          >
            No custom profiles yet. Duplicate a print shop’s profile, or start a
            new one.
          </div>
        ) : (
          list(customs, (p) =>
            item(
              p,
              `print-custom-${p.id}`,
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className={SECONDARY}
                  onPress={() => {
                    setEditing({ profile: p, mode: 'edit' })
                  }}
                  data-testid={`print-edit-${p.id}`}
                >
                  Edit…
                </Button>
                <MenuTrigger>
                  <IconButton
                    label="More"
                    size="sm"
                    tooltip={false}
                    className="rounded-md data-[hovered]:bg-field"
                    data-testid={`print-more-${p.id}`}
                  >
                    <Icon name="moreHorizontal" size={16} />
                  </IconButton>
                  <MenuPopover placement="bottom end" className="w-44">
                    <Menu
                      aria-label={`${p.name} options`}
                      onAction={(key) => {
                        if (key === 'dup') {
                          duplicate(p)
                        } else {
                          setDeleting(p)
                        }
                      }}
                      data-testid="print-menu"
                    >
                      <MenuItem id="dup">Duplicate</MenuItem>
                      <MenuItem id="rm" style={{ color: DELETE_RED }}>
                        Delete…
                      </MenuItem>
                    </Menu>
                  </MenuPopover>
                </MenuTrigger>
              </>,
            ),
          )
        )}
      </div>
      {editing === null ? null : (
        <PrintProfileDialog
          key={editing.profile.id}
          profile={editing.profile}
          mode={editing.mode}
          onSave={(profile) => {
            savePrintProfile(profile)
            setEditing(null)
          }}
          onCancel={() => {
            setEditing(null)
          }}
        />
      )}
      <AlertDialog
        isOpen={deleting !== null}
        tone="destructive"
        title={`Delete “${deleting?.name ?? ''}”?`}
        confirmLabel="Delete"
        onCancel={() => {
          setDeleting(null)
        }}
        onConfirm={() => {
          if (deleting !== null) {
            deletePrintProfile(deleting.id)
          }
          setDeleting(null)
        }}
      >
        Books that use it keep its values.
        {deleting?.id === defaultId
          ? ' New books will start with Generic.'
          : null}
      </AlertDialog>
    </>
  )
}
