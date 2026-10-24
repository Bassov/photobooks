import { useState } from 'react'
import { AlertDialog } from './AlertDialog'
import { Badge } from './Badge'
import { Button } from './Button'
import { Dialog, DialogTitle, DialogTrigger } from './Dialog'
import { EmptyState } from './EmptyState'
import { Icon, ICON_NAMES, ICON_SIZES, type IconSize } from './Icon'
import { IconButton } from './IconButton'
import { Menu, MenuItem, MenuPopover, MenuTrigger } from './Menu'
import { Popover, PopoverDialog, PopoverTrigger } from './Popover'
import { ProgressBar } from './ProgressBar'
import { SegmentedControl } from './SegmentedControl'
import { Status } from './Status'
import { ToggleButton } from './ToggleButton'
import {
  enqueueSpecimenErrorToast,
  enqueueSpecimenSuccessToast,
} from './specimenFeedback'
import { ToastRegion } from './Toast'
import { createToastQueue } from './toastQueue'
import { Toolbar } from './Toolbar'
import './SpecimenPage.css'

export function SpecimenPage() {
  const [iconSize, setIconSize] = useState<IconSize>(16)
  const [fit, setFit] = useState('fill')
  const [gridOn, setGridOn] = useState(false)
  const [statusMsg, setStatusMsg] = useState('Ready')
  const [assertiveMsg, setAssertiveMsg] = useState('')
  const [toastQueue] = useState(() => createToastQueue())
  const [alertOpen, setAlertOpen] = useState(false)
  const [menuChoice, setMenuChoice] = useState('')

  return (
    <main className="specimen-page" data-testid="specimen">
      <header className="specimen-header">
        <h1 className="heading">?specimen</h1>
        <span className="specimen-note">
          Dev/test-only · Theme B (light) tokens from docs/design.md
        </span>
      </header>

      <section className="specimen-section" aria-labelledby="specimen-colors">
        <h2 id="specimen-colors">Semantic colour roles</h2>
        <div className="specimen-swatches">
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-background" />
            <span className="specimen-swatch-name">background</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-chrome" />
            <span className="specimen-swatch-name">chrome</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-canvas" />
            <span className="specimen-swatch-name">canvas</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-paper" />
            <span className="specimen-swatch-name">paper</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-foreground" />
            <span className="specimen-swatch-name">foreground</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-primary" />
            <span className="specimen-swatch-name">primary</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-ring" />
            <span className="specimen-swatch-name">ring</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-select" />
            <span className="specimen-swatch-name">select</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-destructive" />
            <span className="specimen-swatch-name">destructive</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-success" />
            <span className="specimen-swatch-name">success</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-warning" />
            <span className="specimen-swatch-name">warning</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-border" />
            <span className="specimen-swatch-name">border</span>
          </div>
        </div>
      </section>

      <section className="specimen-section" aria-labelledby="specimen-type">
        <h2 id="specimen-type">Type scale · Inter + Lora (self-hosted)</h2>
        <div className="specimen-type">
          <span className="heading specimen-type-3xl">
            A week by the sea · 32
          </span>
          <span className="heading specimen-type-2xl">
            Summer by the sea · 26
          </span>
          <span className="heading specimen-type-lg">Section heading · 18</span>
          <span className="specimen-type-base">
            Body 15 · Drag a photo onto a frame
          </span>
          <span className="specimen-type-sm">
            UI 13.5 · Inspector labels and values
          </span>
          <span className="specimen-type-xs">Caption 12 · 6000 × 4000 px</span>
          <span className="eyebrow">Eyebrow 11</span>
        </div>
      </section>

      <section className="specimen-section" aria-labelledby="specimen-radius">
        <h2 id="specimen-radius">Radius</h2>
        <div className="specimen-radii">
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-sm" />
            <span className="specimen-spacing-label">sm</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-md" />
            <span className="specimen-spacing-label">md</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-lg" />
            <span className="specimen-spacing-label">lg</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-xl" />
            <span className="specimen-spacing-label">xl</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-2xl" />
            <span className="specimen-spacing-label">2xl</span>
          </div>
        </div>
      </section>

      <section className="specimen-section" aria-labelledby="specimen-spacing">
        <h2 id="specimen-spacing">Spacing · 4 px base</h2>
        <div className="specimen-spacing">
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-1" />
            <span className="specimen-spacing-label">4</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-2" />
            <span className="specimen-spacing-label">8</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-3" />
            <span className="specimen-spacing-label">12</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-4" />
            <span className="specimen-spacing-label">16</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-6" />
            <span className="specimen-spacing-label">24</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-8" />
            <span className="specimen-spacing-label">32</span>
          </div>
        </div>
      </section>

      <section
        className="specimen-section"
        aria-labelledby="specimen-icons-heading"
        data-testid="specimen-icons"
      >
        <h2 id="specimen-icons-heading">Icon set · in-repo SVG (stroke 2)</h2>
        <div className="specimen-icon-toolbar">
          <span className="specimen-note">Size token</span>
          <div
            className="specimen-icon-sizes"
            role="group"
            aria-label="Icon size"
          >
            {ICON_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className={
                  s === iconSize
                    ? 'specimen-icon-size specimen-icon-size-active'
                    : 'specimen-icon-size'
                }
                aria-label={`Icon size ${String(s)}`}
                aria-pressed={s === iconSize}
                onClick={() => {
                  setIconSize(s)
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="specimen-note specimen-icon-hint">
            decorative = aria-hidden · icon-only controls need a label
          </span>
        </div>
        <div className="specimen-icon-grid">
          {ICON_NAMES.map((name) => (
            <div key={name} className="specimen-icon-cell">
              <Icon name={name} size={iconSize} />
              <span className="specimen-swatch-name">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="specimen-section"
        aria-labelledby="specimen-actions-heading"
        data-testid="specimen-actions"
      >
        <h2 id="specimen-actions-heading">
          Actions · Button / IconButton / Toggle / Segmented / Toolbar
        </h2>
        <p className="specimen-note">
          Inventory states · tokens only · React Aria (default / secondary /
          ghost = roadmap primary / secondary / quiet)
        </p>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">Button variants × sizes</span>
          <div className="specimen-actions-row">
            <Button variant="default" size="md">
              Save
            </Button>
            <Button variant="secondary" size="md">
              Cancel
            </Button>
            <Button variant="ghost" size="md">
              Quiet
            </Button>
            <Button variant="default" size="sm">
              Save sm
            </Button>
            <Button variant="secondary" size="sm">
              Cancel sm
            </Button>
            <Button variant="ghost" size="sm">
              Quiet sm
            </Button>
            <Button variant="default" size="md" isDisabled>
              Disabled
            </Button>
            <Button variant="default" size="md" isPending>
              Saving…
            </Button>
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">IconButton + Tooltip</span>
          <div
            className="specimen-actions-row"
            data-testid="specimen-icon-buttons"
          >
            <IconButton label="Undo (Ctrl+Z)" size="md">
              <Icon name="undo" />
            </IconButton>
            <IconButton label="Redo (Shift+Ctrl+Z)" size="sm">
              <Icon name="redo" />
            </IconButton>
            <IconButton label="Nothing to redo" isDisabled>
              <Icon name="redo" />
            </IconButton>
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">ToggleButton</span>
          <div className="specimen-actions-row">
            <ToggleButton
              aria-label="Grid"
              isSelected={gridOn}
              onChange={setGridOn}
            >
              <Icon name="grid" />
            </ToggleButton>
            <ToggleButton aria-label="Guides" defaultSelected variant="outline">
              <Icon name="guides" />
            </ToggleButton>
            <ToggleButton aria-label="Rulers" isDisabled>
              <Icon name="rulers" />
            </ToggleButton>
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">SegmentedControl</span>
          <div className="specimen-actions-row specimen-actions-row--narrow">
            <SegmentedControl
              label="Fit"
              value={fit}
              onChange={setFit}
              items={[
                { id: 'fill', label: 'Fill' },
                { id: 'fit', label: 'Fit' },
                { id: 'original', label: 'Original' },
              ]}
            />
            <SegmentedControl
              label="Units"
              size="sm"
              defaultValue="mm"
              items={[
                { id: 'mm', label: 'mm' },
                { id: 'cm', label: 'cm' },
                { id: 'in', label: 'in' },
              ]}
            />
            <span className="specimen-note" data-testid="specimen-fit-value">
              fit={fit}
            </span>
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">Toolbar (roving focus)</span>
          <Toolbar aria-label="Editor tools">
            <IconButton label="Undo (Ctrl+Z)" tooltip={false}>
              <Icon name="undo" />
            </IconButton>
            <IconButton label="Redo" tooltip={false} isDisabled>
              <Icon name="redo" />
            </IconButton>
            <ToggleButton aria-label="Snap" defaultSelected size="sm">
              <Icon name="grid" />
            </ToggleButton>
            <Button variant="secondary" size="sm">
              Preview
            </Button>
          </Toolbar>
        </div>
      </section>

      <section
        className="specimen-section"
        aria-labelledby="specimen-feedback-heading"
        data-testid="specimen-feedback"
      >
        <h2 id="specimen-feedback-heading">
          Feedback · Status / Toast / Badge / Progress / EmptyState
        </h2>
        <p className="specimen-note">
          Live regions · transient errors · inventory badge tones · determinate
          / indeterminate progress
        </p>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">Status</span>
          <div className="specimen-actions-row">
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setStatusMsg('Saved')
              }}
            >
              Announce polite
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setAssertiveMsg('Import failed for 2 files')
              }}
            >
              Announce assertive
            </Button>
            <Status data-testid="specimen-status-polite">{statusMsg}</Status>
            <Status
              politeness="assertive"
              data-testid="specimen-status-assertive"
            >
              {assertiveMsg}
            </Status>
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">Toast</span>
          <div className="specimen-actions-row">
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                enqueueSpecimenErrorToast(toastQueue, () => {
                  setStatusMsg(
                    'Opened import-errors panel (grouped by reason; dismiss / Clear all)',
                  )
                })
              }}
            >
              Show error toast
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                enqueueSpecimenSuccessToast(toastQueue)
              }}
            >
              Show success toast
            </Button>
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">Badge</span>
          <div className="specimen-actions-row" data-testid="specimen-badges">
            <Badge color="gray" dot>
              Saved
            </Badge>
            <Badge color="brand">Placed</Badge>
            <Badge color="success" type="pill-color">
              Ready
            </Badge>
            <Badge color="warning" size="md">
              Pending
            </Badge>
            <Badge color="error" size="lg" dot>
              Error
            </Badge>
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">ProgressBar</span>
          <div className="specimen-progress" data-testid="specimen-progress">
            <ProgressBar
              label="Import progress"
              value={42}
              data-testid="specimen-progress-determinate"
            />
            <ProgressBar
              label="Working"
              isIndeterminate
              data-testid="specimen-progress-indeterminate"
            />
          </div>
        </div>

        <div className="specimen-actions-block">
          <span className="specimen-swatch-name">EmptyState</span>
          <EmptyState
            icon={<Icon name="folder" size={20} />}
            title="Start with your photos"
            description="Choose a photo folder to build the gallery."
            actions={
              <Button
                variant="default"
                size="sm"
                onPress={() => {
                  setStatusMsg('Choose photo folder…')
                }}
              >
                Choose photo folder…
              </Button>
            }
          />
        </div>
      </section>

      <section
        className="specimen-section"
        aria-labelledby="specimen-overlays-heading"
        data-testid="specimen-overlays"
      >
        <h2 id="specimen-overlays-heading">
          Overlays · Dialog / AlertDialog / Popover / Menu
        </h2>
        <p className="specimen-note">
          React Aria overlays · Esc closes dismissable surfaces · AlertDialog
          confirm uses filled destructive
        </p>

        <div className="specimen-actions-block">
          <div className="specimen-actions-row">
            <DialogTrigger>
              <Button variant="secondary" size="sm">
                Open dialog
              </Button>
              <Dialog>
                <DialogTitle>Library details</DialogTitle>
                <p className="specimen-note">
                  A short modal for project metadata.
                </p>
              </Dialog>
            </DialogTrigger>

            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setAlertOpen(true)
              }}
            >
              Open alert
            </Button>

            <PopoverTrigger>
              <Button variant="secondary" size="sm">
                Open popover
              </Button>
              <Popover>
                <PopoverDialog>
                  <p className="specimen-note">Popover body</p>
                </PopoverDialog>
              </Popover>
            </PopoverTrigger>

            <MenuTrigger>
              <Button variant="secondary" size="sm">
                Open menu
              </Button>
              <MenuPopover>
                <Menu
                  onAction={(key) => {
                    setMenuChoice(String(key))
                    setStatusMsg(`Menu: ${String(key)}`)
                  }}
                >
                  <MenuItem id="duplicate">Duplicate</MenuItem>
                  <MenuItem id="delete" variant="destructive">
                    Delete
                  </MenuItem>
                </Menu>
              </MenuPopover>
            </MenuTrigger>

            <span className="specimen-note" data-testid="specimen-menu-choice">
              menu={menuChoice || '—'}
            </span>
          </div>
        </div>

        <AlertDialog
          isOpen={alertOpen}
          title="Remove “Road trip”?"
          onCancel={() => {
            setAlertOpen(false)
            setStatusMsg('Alert cancelled')
          }}
          onConfirm={() => {
            setAlertOpen(false)
            setStatusMsg('Alert confirmed')
          }}
        >
          The book disappears from this library. Photos stay on disk.
        </AlertDialog>
      </section>

      <ToastRegion queue={toastQueue} data-testid="specimen-toast-region" />
    </main>
  )
}
