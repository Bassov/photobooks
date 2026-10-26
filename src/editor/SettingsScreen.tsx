import { useState } from 'react'
import { AlertDialog } from '../ui/AlertDialog'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { FeaturedIcon } from '../ui/FeaturedIcon'
import { Icon } from '../ui/Icon'
import { changeLibraryFolder } from './projectSession'
import {
  SETTINGS_DEFERRED_COPY,
  SETTINGS_SECTIONS,
  settingsNavActiveClass,
  settingsNavIsCurrent,
  settingsSectionLabel,
  type SettingsSectionId,
} from './settingsScreenModel'

const ROW =
  'flex min-h-13 items-center gap-4 px-4 py-2' /* v0.9.1: no card border; chrome surface only */

export function SettingsScreen({
  libraryPath,
  bookCount,
  changeDisabled,
}: {
  libraryPath: string
  bookCount: number
  changeDisabled?: boolean
}) {
  const [sec, setSec] = useState<SettingsSectionId>('library')
  const [confirm, setConfirm] = useState(false)
  const sectionLabel = settingsSectionLabel(sec)

  return (
    <div
      className="grid h-full min-h-0 grid-cols-[220px_1fr] bg-background"
      data-testid="settings"
    >
      <nav className="flex flex-col gap-0.5 border-r bg-chrome p-3">
        <div className="mb-3 flex items-center gap-2 px-2 pt-1">
          <div className="grid size-6 place-items-center rounded-md bg-field text-foreground">
            <Icon name="bookOpen" size={14} className="size-3" />
          </div>
          <span className="text-base font-semibold">Settings</span>
        </div>
        {SETTINGS_SECTIONS.map((section) => {
          const active = settingsNavIsCurrent(sec, section.id)
          return (
            <button
              key={section.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              data-testid={`settings-nav-${section.id}`}
              onClick={() => {
                setSec(section.id)
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring',
                settingsNavActiveClass(active),
              )}
            >
              <Icon
                name={section.icon}
                size={16}
                className="size-4 text-muted-foreground"
              />
              {section.label}
            </button>
          )
        })}
      </nav>
      <main
        id="settings-scroll"
        className="min-h-0 overflow-auto px-8 py-6"
        data-scrollport="settings"
        data-testid="settings-scroll"
      >
        <h1 className="heading text-2xl" data-testid="settings-section-title">
          {sectionLabel}
        </h1>
        {sec === 'library' ? (
          <>
            <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
              Photobooks keeps every book in one folder on your disk — your
              library. To use a different library, change the folder.
            </p>
            <div
              className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome"
              data-testid="library-settings-panel"
            >
              <div className={ROW}>
                <FeaturedIcon color="gray" theme="outline" size="md">
                  <Icon name="hardDrive" size={16} />
                </FeaturedIcon>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Library folder</div>
                  <div
                    className="truncate font-mono text-xs text-muted-foreground"
                    data-testid="library-path"
                    title={libraryPath}
                  >
                    {libraryPath}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 px-3 text-sm shadow-xs [&_svg]:size-4"
                  isDisabled={Boolean(changeDisabled)}
                  onPress={() => {
                    setConfirm(true)
                  }}
                  data-testid="change-library"
                >
                  <Icon name="folderSync" size={16} />
                  Change library folder…
                </Button>
              </div>
              <div
                className="mx-4 h-px shrink-0 bg-black/[0.06]"
                aria-hidden
                data-testid="settings-rule"
              />
              <div className={ROW}>
                <div className="min-w-0 flex-1 text-sm">Books</div>
                <span
                  className="text-sm tabular-nums text-muted-foreground"
                  data-testid="settings-book-count"
                >
                  {bookCount}
                </span>
              </div>
              <div
                className="mx-4 h-px shrink-0 bg-black/[0.06]"
                aria-hidden
                data-testid="settings-rule"
              />
              <div className={ROW}>
                <div className="min-w-0 flex-1 text-sm">Folder access</div>
                <Badge color="success" dot>
                  Allowed · read and write
                </Badge>
              </div>
            </div>
          </>
        ) : (
          <div
            className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome px-4 py-5"
            data-testid={`settings-deferred-${sec}`}
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              {SETTINGS_DEFERRED_COPY[sec]}
            </p>
          </div>
        )}
      </main>

      <AlertDialog
        isOpen={confirm}
        tone="neutral"
        title="Change the library folder?"
        confirmLabel="Choose folder…"
        onCancel={() => {
          setConfirm(false)
        }}
        onConfirm={() => {
          setConfirm(false)
          void changeLibraryFolder()
        }}
      >
        Photobooks works with one library at a time. Your books stay in{' '}
        <span className="font-mono text-sm text-foreground/80">
          {libraryPath}
        </span>{' '}
        — nothing is moved or deleted. Pick another folder to use it as the
        library (an empty folder starts a new one). Change it back to see these
        books again.
      </AlertDialog>
    </div>
  )
}
