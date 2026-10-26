## Implementation

- [x] 1. Copy Lora italic woff2 (latin, latin-ext, cyrillic) into `public/fonts/` and `uikit/src/fonts/`; extend both `fonts.css` with italic `@font-face` — `public/fonts/`, `uikit/src/fonts/`
- [x] 2. Set `.pb-welcome-headline { font-weight: 400 }`; keep `<em>` and existing size/leading/tracking — `welcomeScreenStyles.ts`
- [x] 3. Unit/style tests for weight 400 + italic `@font-face` presence; confirm Create Library markup unchanged — `welcomeScreenStyles.test.ts`, `WelcomeScreen.test.tsx`, `loraFonts.test.ts`

## Manual test scenarios

1. Cold `/` — Welcome h1 Regular 400; second line true Lora italic; Create Library visible; document fits viewport
2. Create Library cancel stays on Welcome; families remain Inter + Lora Variable
