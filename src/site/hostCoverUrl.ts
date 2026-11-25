import { createContext } from 'react'

/**
 * The host app's own front cover photo URL (the editor Preview's working
 * preview object URL). Page data never sets it, so `CoverFace` paints it
 * without `imageSrc`, which keeps page-data paths only; it wins over the
 * entry's published cover.
 */
export const HostCoverUrl = createContext<string | undefined>(undefined)
