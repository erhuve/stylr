# Stylr

An illustrated personal-style discovery app: adjust a figure, react to outfits, and collect a tentative portrait of what catches your eye. Built for personal use on a Zo Computer, with no account, uploads, AI service, or shopping inventory required.

## Project Notes

- Canonical project: `Sites/stylr`; GitHub: https://github.com/erhuve/stylr. The earlier `Sites/style-study` prototype is separate and must not be edited as part of this app.
- Three screens: **Your figure → Explore → Your portrait**. There are 24 curated looks, four in each of six directions. An early portrait is available after six reactions; completion occurs at 24. Changing figure settings never restricts styles.
- `FashionModel.tsx` is the single renderer: deterministic SVG geometry for shoulders, chest, waist, hips, and torso/leg balance, six skin tones and three hairstyles. Body and clothing change together; this is illustration, not sizing or virtual try-on. Skin values from the earlier prototype remain readable.
- Illustration provenance: model faces, bodies, garment silhouettes, patterns and accessories are drawn programmatically as SVG paths and shapes in `FashionModel.tsx`. The 24 authored outfit descriptions, garment types and palettes are in `looks.ts`; these are not model photos, scraped retailer imagery, image-generation outputs or a product inventory.
- Visual direction: warm paper, olive ink, Instrument Serif and DM Sans. Fonts are self-hosted with OFL licenses in `public/fonts`. `src/theme.json` is the palette source of truth; `zo-theme.ts` generates variables. Do not reintroduce duplicate palette values in `styles.css`—they override the theme in development.
- No login, server-side personal database, cross-device sync, photo processing or generative outfit model. Personal state stays in browser localStorage. Different preview/published origins have separate storage.

## Behavior and inference

Wear, admire, pass and unsure are separate reactions. Admiration contributes to inspiration but never shopping recommendations. The first six cards cover all directions, followed by deterministic trait affinity with exploration every third reaction. Cards never repeat except when explicitly undoing.

Scores use integer weights before normalization: wear +100, admire +65, pass −55, unsure 0; explicit more +150 and less −180. This avoids reaction-order-dependent floating-point ties. The portrait reports evidence, treats broad ties as ambiguous and does not invent positive preferences from all-pass/unsure sessions. It remains a small curated experiment, not a definitive classification.

Freeform notes (600 characters) are saved as text, not interpreted by AI or converted into hidden restrictions. More/less chips guide future cards; the same trait cannot be in both lists. Four explicit exclusions apply only to shopping: heels, skirts, shorts and boots. Suggestions must be looks marked wear and permitted by every exclusion. Budget adds a per-piece search hint to Google Shopping, not a verified price filter. No affiliates or automatic purchases. Existing clothes are encouraged first.

## Data safety

- Session schema version 1, key `style-study:v1`; missing legacy exclusions default to empty. Validation rejects duplicate votes, invalid IDs/traits, invalid body values, oversized text and unknown structure. Impossible screen states and stale drafts normalize safely.
- Draft changes save as you type. Revisiting the figure and reloading retain the current card and draft. Undo restores the previous card with its feedback; a nonempty current draft requires explicit discard confirmation, with a download option.
- Reads and writes are compared inside origin-wide Web Locks. Cross-tab differences pause saving; neither version is silently chosen. In environments without Web Locks, exploration remains available in memory with a warning instead of unsafe writes.
- Corrupt/unsupported saved data is not silently replaced. Failed reload preserves current work. Failed clear retains both visible and saved data, reports the failure and permits retry. Clear/reset always requires confirmation.
- Export Markdown includes all reactions, traits, notes, figure settings, exclusions and the unfinished draft, with untrusted markup escaped. Session JSON export preserves machine-readable data. JSON import is not implemented. Browser-data deletion loses the saved study; exports are the portable copy.
- Async save status is visible. A lock still pending when a tab is forcibly closed can lose unsaved work; use the save indicator and download important notes. Coordination is between this app’s tabs, not arbitrary same-origin software that ignores its lock.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/pages/style-study.tsx` | Screen flow, native dialogs, keyboard/touch interactions, exports |
| `src/components/FashionModel.tsx` | Parametric SVG figure and garments |
| `src/lib/looks.ts` | Curated look catalog, trait and direction copy |
| `src/lib/style-types.ts` | Domain and persisted session types |
| `src/lib/style-engine.ts` | Validation, reversible voting, scoring, selection, recommendations, export |
| `src/lib/use-study.ts` | Browser persistence, Web Locks, conflict and failure handling |
| `src/study.css`, `src/styles.css`, `src/theme.json` | Responsive/editorial styling and theme |
| `tests/engine.test.ts` | Deterministic engine and hostile-input unit tests |
| `tests/browser/` | Production-bundle browser, accessibility, fault, touch and SVG tests |
| `docs/verification/` | Browser screenshots and review resolution evidence |
| `server.ts` | Bun + Hono, Vite middleware in development, static build in production |

## Validation

Install dependencies with `bun install --frozen-lockfile`. Run:

- `bun run typecheck`
- `bun test tests/engine.test.ts`
- `bun run build`
- `bunx playwright install chromium` (once on a new machine)
- `bun run test:browser`

`CHROMIUM_PATH` optionally selects an installed Chromium executable. By default Playwright fulfills `https://stylr.test` requests from the actual `dist` files—real React, JavaScript, CSS, fonts, browser storage and interactions, no development server required. This does **not** verify hosting/proxy behavior. Set `TEST_BASE_URL` to an already-running site to test that deployment; the fixture then disables interception. Tests never start or restart the managed app.

The browser suite checks 320/390/768/1440 layouts, axe WCAG A/AA rules, safe downloads, draft resume, exhaustion, repeated input, native dialogs, synthetic/CDP touch events, blocked/corrupt storage, cross-tab contention and all 32 slider-extreme combinations across 24 outfits plus a neutral figure (800 renders). Desktop/mobile screenshots are generated into `docs/verification`. Actual screen-reader and physical-device testing remain manual; automated checks are not a claim of full accessibility certification.

## Hosting

This is a Zo Site: Bun + Hono + React 19 + Vite + TypeScript, with React Compiler enabled. `src/App.tsx` directly renders the study at the SPA entry point. No custom backend data endpoint is needed.

Zo manages development and publishing processes. Never start/restart them manually or edit system fields in `zosite.json` (ports, entrypoints, publish label/type). Publish only when explicitly requested; pushing this repo does not publish the site.

Public deployment (published September 9, 2026, America/New_York): https://stylr-hatsunemiku.zocomputer.io/

All 26 browser tests passed against this HTTPS deployment with `TEST_BASE_URL` and no request interception, including 800 figure renders. Public GET `/` and a self-hosted font returned 200. HEAD `/` currently returns 404 from the inherited server template; browser GET navigation works. Separate private development preview: https://zite-53955-hatsunemiku.zo.computer/ (not required by the public production service). Browser-local studies are separate for each origin; preview data does not automatically migrate to the public URL.

Completion scope and review resolutions: `docs/plans/stylr-completion.md` and `docs/verification/review.md`.
