# M2.6 — notes

**Order:** After remaining M2.1 gates and M2.2 correctness as needed, port product screens onto UI kit **v0.9.3** (in-repo at `uikit/`). Then resume M3–M4.5 on the new chrome. M5/M7 site and M6 print kit demos are **not now** (parked until photo preprocessing + Cloudflare).

**Decision (owner, 2026-10-26):** replace product UI with the Designer-approved kit; existing chrome may be thrown away. Keep working logic: FSA import, `bookStore` / `projectSession`, filmstrip place/crop, checking-photos reload. Priority: finished editor first, then personal site, then print, then multi-user.

**Packages (one agent each):** A `uikit-sync` (done, #204) → B `ui-tw-bridge-v093` (done, #206) → D `ui-welcome-v93` → E `ui-unsupported-v93` → F `ui-library-empty-v93` → G `ui-library-grid-v93` → H `ui-settings-stub-v93` → I `ui-editor-shell-v93` → J `ui-editor-parity-v93`. (C is this roadmap docs revision.)

**UI refs:** `uikit#/demo`, `uikit#/full/editor`, `uikit#/screen/first-run`, `uikit#/screen/home`, `uikit#/screen/settings`, `uikit#/screen/unsupported-browser`, `uikit#/screen/editor`. App never imports `uikit/src/**` — port by copy.
