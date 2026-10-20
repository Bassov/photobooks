import { useEffect, useSyncExternalStore } from 'react'
import { installRelinkAutoDetect } from './autoDetect'
import { RelinkDialog } from './RelinkDialog'
import {
  missingPillLabel,
  openRelinkReview,
  readRelinkPillCount,
  shouldShowMissingPill,
} from './hostModel'
import { rescanRelinkFiles, resolvePendingRelink } from './rescan'
import { subscribeRelink } from './statusStore'

/** Thin pill + dialog; auto-detect installs outside the render path. */
export function RelinkHost() {
  const count = useSyncExternalStore(
    subscribeRelink,
    readRelinkPillCount,
    readRelinkPillCount,
  )

  useEffect(installRelinkAutoDetect, [])

  return (
    <>
      {shouldShowMissingPill(count) ? (
        <div
          className="missing-assets-pill"
          data-testid="missing-assets-pill"
          role="status"
        >
          {missingPillLabel(count)}
          <button
            type="button"
            data-testid="missing-assets-review"
            onClick={openRelinkReview}
          >
            Review…
          </button>
        </div>
      ) : null}
      <RelinkDialog
        onRescanFiles={rescanRelinkFiles}
        onResolve={resolvePendingRelink}
      />
    </>
  )
}
