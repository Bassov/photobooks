import type { FeatureDef } from "./types"
import { M0M1 } from "./m0m1"
import { M2 } from "./m2"
import { M25 } from "./m25"
import { M3 } from "./m3"
import { M4 } from "./m4"
import { M45 } from "./m45"
import { M5, M7 } from "./m5m7"
import { M6, M8 } from "./m6m8"

/** slug (roadmap item slug, see src/kit/pages.json) → demo + UX notes */
export const FEATURES: Record<string, FeatureDef> = { ...M0M1, ...M2, ...M25, ...M3, ...M4, ...M45, ...M5, ...M7, ...M6, ...M8 }
