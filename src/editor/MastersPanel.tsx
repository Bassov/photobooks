import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { nextParentId, type ParentSpread } from '../core'
import { useClientSize } from './useClientSize'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  Menu,
  MenuItem,
  MenuPopover,
  MenuSeparator,
  MenuTrigger,
} from '../ui/Menu'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { FIELD, SUB, T } from './editorChromeTokens'
import { setBookSettingsSelected } from './bookSettingsSelection'
import { setFrameSource } from './frameSelection'
import {
  getPickedParentId,
  setPickedParentId,
  shownParentId,
  subscribeLeftPanelTab,
} from './leftPanelTabStore'
import { focusRenameInput } from './libraryRename'
import { SpreadThumb } from './SpreadThumb'
import { spreadsRowGeometry } from './spreadsPanelModel'

const NO_PARENTS: readonly ParentSpread[] = []

function readParents(): readonly ParentSpread[] {
  return getBookStoreSnapshot().book.parents ?? NO_PARENTS
}

function readDefaultId(): string | undefined {
  return getBookStoreSnapshot().book.defaultParentId
}

/** A parent is always a two-page spread. */
function readAspect(): number {
  const { widthMm, heightMm } = getBookStoreSnapshot().book.settings.trim
  return (2 * widthMm) / heightMm
}

function pick(id: string): void {
  // A frame picked on another master (or a page) is not on this canvas.
  setFrameSource(null)
  setBookSettingsSelected(false)
  setPickedParentId(id)
}

/**
 * Kit Masters list (uikit/src/sandbox/chrome.tsx:272-321): a note naming the
 * book default, the book's parents as thumb rows (the default tagged), Make
 * default / Rename / Delete per row and "New master" under the list.
 */
export function MastersPanel({ modeSwitch }: { modeSwitch: ReactNode }) {
  const parents = useSyncExternalStore(
    subscribeBookStore,
    readParents,
    readParents,
  )
  const defaultId = useSyncExternalStore(
    subscribeBookStore,
    readDefaultId,
    readDefaultId,
  )
  const defaultParent = parents.find((parent) => parent.id === defaultId)
  const picked = useSyncExternalStore(
    subscribeLeftPanelTab,
    getPickedParentId,
    getPickedParentId,
  )
  const aspect = useSyncExternalStore(
    subscribeBookStore,
    readAspect,
    readAspect,
  )
  const [list, attachList] = useClientSize()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const geometry = spreadsRowGeometry(list?.width ?? 0, aspect)
  const shown = shownParentId(parents, picked)
  const commitRename = (id: string, name: string): void => {
    setRenamingId(null)
    dispatchBookOp({ type: 'renameParent', parentId: id, name })
  }
  return (
    <aside
      className="editor-spreads flex h-full min-h-0 flex-col"
      data-testid="masters-panel"
    >
      <div className="shrink-0 px-3 pb-2 pt-3" data-testid="mode-seg">
        {modeSwitch}
      </div>
      <div
        ref={attachList}
        className="e7 scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-1"
        data-testid="masters-list"
        data-scrollport="masters-list"
      >
        {parents.length === 0 ? (
          <div className="editor-masters-empty" data-testid="masters-empty">
            <div className="editor-masters-empty-title">No masters yet</div>
            <div className="editor-masters-empty-description">
              Masters are page templates shared across spreads.
            </div>
          </div>
        ) : (
          <>
            {defaultParent === undefined ? null : (
              <p
                className="editor-masters-intro"
                style={{ color: SUB }}
                data-testid="masters-intro"
              >
                Anything on a master repeats on its pages. Spreads use the
                default, <b style={{ color: T }}>{defaultParent.name}</b>,
                unless they pick another.
              </p>
            )}
            <div role="listbox" aria-label="Masters">
              {parents.map((parent) => {
                const sel = parent.id === shown
                const isDefault = parent === defaultParent
                const thumb = (
                  <div
                    className="editor-spread-thumb grid w-full place-items-center"
                    style={{ height: geometry.boxHeightPx }}
                  >
                    <SpreadThumb
                      spreadId={parent.id}
                      boxWidthPx={geometry.boxWidthPx}
                      boxHeightPx={geometry.boxHeightPx}
                    />
                  </div>
                )
                return (
                  <div
                    key={parent.id}
                    role="presentation"
                    className="group/sp relative mb-1"
                    data-selected={sel ? 'true' : undefined}
                  >
                    {renamingId === parent.id ? (
                      <div className="e7-item rounded-md p-2">
                        {thumb}
                        <input
                          aria-label="Master name"
                          defaultValue={parent.name}
                          ref={focusRenameInput}
                          className="mt-1.5 w-full rounded-sm px-1 text-2xs"
                          style={{ background: FIELD, color: T }}
                          data-testid="master-rename-input"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitRename(parent.id, event.currentTarget.value)
                            } else if (event.key === 'Escape') {
                              // A blur on unmount then commits the old name (no-op).
                              event.currentTarget.value = parent.name
                              setRenamingId(null)
                            }
                          }}
                          onBlur={(event) => {
                            commitRename(parent.id, event.currentTarget.value)
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        role="option"
                        aria-selected={sel}
                        aria-label={
                          isDefault ? `${parent.name}, default` : undefined
                        }
                        className="e7-item w-full rounded-md p-2"
                        data-item={parent.id}
                        data-testid={`master-list-item-${parent.id}`}
                        onClick={() => {
                          pick(parent.id)
                        }}
                        onDoubleClick={() => {
                          setRenamingId(parent.id)
                        }}
                      >
                        {thumb}
                        <div className="mt-1.5 flex text-2xs">
                          <span
                            data-label
                            className={sel ? 'font-semibold' : 'font-normal'}
                          >
                            {parent.name}
                          </span>
                          {isDefault ? (
                            <span
                              className="editor-master-default-tag"
                              style={{ color: sel ? T : SUB }}
                              data-testid="master-default-tag"
                            >
                              Default
                            </span>
                          ) : null}
                        </div>
                      </button>
                    )}
                    <MenuTrigger>
                      <IconButton
                        label={`${parent.name} actions`}
                        size="sm"
                        tooltip={false}
                        className="spread-row-menu"
                        data-testid={`master-menu-${parent.id}`}
                      >
                        <Icon name="moreHorizontal" size={14} />
                      </IconButton>
                      <MenuPopover placement="bottom end" className="w-44">
                        <Menu
                          className="[&_svg]:size-4 [&_svg]:text-muted-foreground"
                          onAction={(key) => {
                            if (key === 'make-default') {
                              dispatchBookOp({
                                type: 'setDefaultParent',
                                parentId: parent.id,
                              })
                            } else if (key === 'rename') {
                              setRenamingId(parent.id)
                            } else {
                              dispatchBookOp({
                                type: 'removeParent',
                                parentId: parent.id,
                              })
                            }
                          }}
                        >
                          {isDefault ? null : (
                            <MenuItem
                              id="make-default"
                              textValue="Make default"
                              data-testid="master-menu-make-default"
                            >
                              <Icon name="check" size={16} />
                              Make default
                            </MenuItem>
                          )}
                          <MenuItem
                            id="rename"
                            textValue="Rename"
                            data-testid="master-menu-rename"
                          >
                            <Icon name="pencil" size={16} />
                            Rename
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            id="delete"
                            textValue="Delete"
                            variant="destructive"
                            isDisabled={isDefault}
                            data-testid="master-menu-delete"
                          >
                            {/* A disabled item takes no pointer; the label still shows why. */}
                            <span
                              className="editor-master-menu-label"
                              title={
                                isDefault
                                  ? 'Make another master the default first'
                                  : undefined
                              }
                            >
                              <Icon name="delete" size={16} />
                              Delete
                            </span>
                          </MenuItem>
                        </Menu>
                      </MenuPopover>
                    </MenuTrigger>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="e7-ghost mx-3 mb-3 flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm [&_svg]:size-3.5"
        style={{ color: SUB }}
        data-testid="new-master"
        onClick={() => {
          const id = nextParentId(getBookStoreSnapshot().book)
          dispatchBookOp({ type: 'addParent', id })
          pick(id)
        }}
      >
        <Icon name="plus" />
        New master
      </button>
    </aside>
  )
}
