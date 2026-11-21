/*
 * Designer fill-book F1–F12 (kit `uikit/src/sandbox/chrome.tsx` FillBook):
 * the filmstrip head's first chip and its confirm popover with the numbers.
 * Disabled stays in place; the reason is the wrapping span's `title` (a
 * disabled react-aria button gets no tooltip).
 */
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import {
  bookPrintProfile,
  pageCountRange,
  planFillBook,
  type Book,
} from '../core'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { MenuPopover } from '../ui/Menu'
import { PopoverDialog, PopoverTrigger } from '../ui/Popover'
import {
  dispatchBookOp,
  getAssetDisplayName,
  getAssetTimeMs,
  getBookStoreSnapshot,
  getGalleryIdsSnapshot,
  getPlacedAssetIdsSnapshot,
  subscribeBookStore,
  subscribeGallery,
} from './bookStore'
import { fillBookStatus, flashEditorStatus } from './editorStatus'
import { setFrameSource } from './frameSelection'
import { revealFrames } from './frameReveal'
import { deriveGalleryView, type GallerySortKey } from './galleryView'
import { getLeftPanelTab, subscribeLeftPanelTab } from './leftPanelTabStore'
import { setActiveSpreadId } from './photoRootSession'
import { getRelinkStatuses, subscribeRelink } from './relink/statusStore'
import { getSavedTemplates } from './savedTemplates'

export const FILL_BOOK_STATUS_MS = 4000

const ORDER: Record<GallerySortKey, string> = {
  added: 'in Added order',
  captured: 'by Date taken',
  name: 'by File name',
}

const plural = (n: number, noun: string): string =>
  `${String(n)} ${noun}${n === 1 ? '' : 's'}`

const bookOf = (): Book => getBookStoreSnapshot().book

/** F9: new spreads stop at the print profile's page maximum. */
const maxPagesOf = (book: Book): number =>
  pageCountRange(bookPrintProfile(book)).max

/** The first spread `next` added or changed (core keeps the others `===`). */
const firstChanged = (prev: Book, next: Book): Book['spreads'] => {
  const old = new Set(prev.spreads)
  return next.spreads.filter((spread) => !old.has(spread)).slice(0, 1)
}

function Row({
  testId,
  label,
  children,
}: {
  testId: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex h-[22px] items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className="font-medium text-[var(--foreground)] tabular-nums"
        data-testid={testId}
      >
        {children}
      </span>
    </div>
  )
}

const Sep = () => <div className="-mx-3 my-2.5 h-px bg-[var(--border)]" />

function PlanBody({
  ids,
  sort,
  missing,
  onCancel,
  onConfirm,
}: {
  ids: readonly string[]
  sort: GallerySortKey
  missing: number
  onCancel: () => void
  onConfirm: () => void
}) {
  // Live book snapshot while open (the popover mounts this only when shown).
  const book = useSyncExternalStore(subscribeBookStore, bookOf, bookOf)
  const profile = bookPrintProfile(book).name
  const plan = planFillBook(book, ids, maxPagesOf(book))
  const count = ids.length
  const fits = plan.intoFrames + plan.onNewSpreads > 0
  const max = String(plan.maxPages)
  const stay = plan.leftover === 1 ? 'stays' : 'stay'
  return (
    <>
      <div className="text-sm leading-[18px] font-semibold text-[var(--foreground)]">
        Fill book
      </div>
      <div
        className="mt-0.5 text-xs leading-[16.8px] text-muted-foreground"
        data-testid="fill-book-order"
      >
        {plural(count, 'unplaced photo')}, {ORDER[sort]}.
      </div>
      {fits ? (
        <>
          <Sep />
          <Row testId="fill-book-frames" label="Empty frames">
            {plan.intoFrames > 0 ? plural(plan.intoFrames, 'photo') : 'none'}
          </Row>
          <Row testId="fill-book-spreads" label="New spreads">
            {plan.onNewSpreads > 0 ? (
              <>
                {plural(plan.onNewSpreads, 'photo')}
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · {plural(plan.newSpreads, 'spread')}
                </span>
              </>
            ) : (
              'none'
            )}
          </Row>
          <Row testId="fill-book-pages" label="Pages">
            {plan.pagesAfter === plan.pagesBefore
              ? String(plan.pagesBefore)
              : `${String(plan.pagesBefore)} → ${String(plan.pagesAfter)}`}
          </Row>
          {missing > 0 ? (
            <div
              className="mt-1.5 text-xs text-muted-foreground"
              data-testid="fill-book-missing"
            >
              {plural(missing, 'photo')} with missing files{' '}
              {missing === 1 ? 'is' : 'are'} skipped.
            </div>
          ) : null}
        </>
      ) : null}
      {plan.leftover > 0 ? (
        <div
          className="mt-1.5 flex gap-1.5 text-xs leading-[16.8px] text-[var(--warning-ink)]"
          data-testid="fill-book-left"
        >
          <Icon name="warning" size={12} className="mt-0.5 size-3 shrink-0" />
          <span>
            {fits
              ? `${plural(plan.leftover, 'photo')} ${stay} in the filmstrip: ${profile} prints up to ${max} pages.`
              : `No empty frames, and the book is at ${max} pages, the most ${profile} prints.`}
          </span>
        </div>
      ) : null}
      {fits ? (
        <>
          <Sep />
          <div className="text-xs text-muted-foreground">
            The cover and endpapers stay as they are.
          </div>
        </>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          autoFocus={!fits}
          onPress={onCancel}
          data-testid="fill-book-cancel"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="shadow-[var(--shadow-xs)]"
          autoFocus={fits}
          isDisabled={!fits}
          onPress={onConfirm}
          data-testid="fill-book-confirm"
        >
          Fill book
        </Button>
      </div>
    </>
  )
}

/** Filmstrip head "Fill book" chip: places the unplaced photos in `sort` order. */
export function FillBookButton({ sort }: { sort: GallerySortKey }) {
  const [open, setOpen] = useState(false)
  const gallery = useSyncExternalStore(
    subscribeGallery,
    getGalleryIdsSnapshot,
    getGalleryIdsSnapshot,
  )
  const placed = useSyncExternalStore(
    subscribeBookStore,
    getPlacedAssetIdsSnapshot,
    getPlacedAssetIdsSnapshot,
  )
  const tab = useSyncExternalStore(
    subscribeLeftPanelTab,
    getLeftPanelTab,
    getLeftPanelTab,
  )
  const relink = useSyncExternalStore(
    subscribeRelink,
    getRelinkStatuses,
    getRelinkStatuses,
  )
  const unplaced = gallery.filter((id) => !placed.has(id))
  const isMissing = (id: string): boolean => relink.get(id) === 'missing'
  // F3/F4: unplaced, file present, in the filmstrip's sort.
  const usable = deriveGalleryView(
    gallery,
    { sort, unplacedOnly: true },
    {
      name: getAssetDisplayName,
      timeMs: getAssetTimeMs,
      isPlaced: (id) => placed.has(id) || isMissing(id),
    },
  )
  const reason =
    gallery.length === 0
      ? 'Add a folder of photos first'
      : tab === 'masters'
        ? 'Switch to Pages to fill the book'
        : unplaced.length === 0
          ? 'Every photo is placed'
          : usable.length === 0
            ? "The unplaced photos' files are missing"
            : ''
  const confirm = () => {
    setOpen(false)
    const prev = bookOf()
    const maxPages = maxPagesOf(prev)
    const done = planFillBook(prev, usable, maxPages)
    dispatchBookOp({
      type: 'fillBook',
      assetIds: usable,
      templates: getSavedTemplates(),
      maxPages,
    })
    // F11: one undo step; the spread that got the first photo becomes active,
    // no frame selected, revealed only when out of view (zoom kept).
    for (const spread of firstChanged(prev, bookOf())) {
      setFrameSource(null)
      setActiveSpreadId(spread.id)
      revealFrames(
        spread.id,
        spread.frames.map((frame) => frame.id),
      )
    }
    flashEditorStatus(
      fillBookStatus(
        done.intoFrames + done.onNewSpreads,
        done.newSpreads,
        done.leftover,
      ),
      FILL_BOOK_STATUS_MS,
    )
  }

  return (
    <span
      className="inline-flex"
      title={reason || 'Place the unplaced photos into the book'}
      data-testid="film-fill-book-wrap"
    >
      <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
        <AriaButton
          className="film-chip film-fill-book inline-flex cursor-default items-center gap-1.5"
          isDisabled={reason !== ''}
          data-testid="film-fill-book"
        >
          <Icon name="bookImage" size={14} className="size-3.5" />
          Fill book
        </AriaButton>
        <MenuPopover
          placement="top end"
          className="w-[296px]"
          data-testid="fill-book-popover"
        >
          <PopoverDialog aria-label="Fill book">
            <PlanBody
              ids={usable}
              sort={sort}
              missing={unplaced.length - usable.length}
              onCancel={() => {
                setOpen(false)
              }}
              onConfirm={confirm}
            />
          </PopoverDialog>
        </MenuPopover>
      </PopoverTrigger>
    </span>
  )
}
