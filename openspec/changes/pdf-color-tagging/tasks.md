## Implementation

- [x] 1. `src/core/pdf/iccProfile.ts`: read the ICC profile from JPEG APP2 / PNG iCCP, classify it (sRGB / Adobe RGB / Display P3 / other), build the sRGB profile; unit + PBT (`iccProfile.test.ts`, `iccProfile.pbt.test.ts`).
- [x] 2. `src/core/pdf/paintPdf.ts`: every embedded image gets an ICCBased color space (source profile, sRGB when untagged); each profile stream once per PDF (`paintPdf.color.test.ts`).
- [x] 3. `src/core/pdf/colorPreflight.ts`: warning per non-sRGB RGB source when the print profile is sRGB; unit tests on the color fixtures (`colorPreflight.test.ts`).

## Manual test scenarios

N/A (no UI; unit tests parse the PDF bytes).
