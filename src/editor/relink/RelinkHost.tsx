import { useEffect, useSyncExternalStore } from 'react'
import { Button } from '../../ui/Button'
import { installRelinkAutoDetect } from './autoDetect'
import { RelinkDialog } from './RelinkDialog'
import {
  missingPillLabel,
  openRelinkReview,
  readRelinkPillCount,
  shouldShowMissingPill,
} from './hostModel'
import { missingPillStyle } from './relinkStyles'
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
          style={missingPillStyle}
          data-testid="missing-assets-pill"
          role="status"
        >
          {missingPillLabel(count)}
          <Button
            variant="secondary"
            size="sm"
            style={{ pointerEvents: 'auto' }}
            data-testid="missing-assets-review"
            onPress={openRelinkReview}
          >
            Review…
          </Button>
        </div>
      ) : null}
      <RelinkDialog
        onRescanFiles={rescanRelinkFiles}
        onResolve={resolvePendingRelink}
      />
    </>
  )
}
