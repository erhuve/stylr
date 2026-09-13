# Stylr

A personal-style discovery app built around real people in real clothing. Public: https://stylr-hatsunemiku.zocomputer.io/ · GitHub: https://github.com/erhuve/stylr.

## Current product

The homepage is a color-photography study: **Your starting point → Explore → Your portrait**. It includes 42 curated references, 14 independently tagged clothing details, a browsable collection, four reactions, explicit more/less feedback, notes, favorites and portable exports. Ten references are additions beyond the prior research shortlist; visible-logo/graphic holds and grayscale candidates were excluded.

The result screen is a photo-first moodboard: actual wear/admire picks appear above the fold with distinct labels, and untried suggestions have a separate view. Complete evidence, downloads, undo and library access are available through **Style notes**, rather than forcing readers to scroll past a report to reach their photos. See `docs/verification/moodboard-review.md` for responsive layout and adversarial-review coverage.

- Optional self-reported sex is independent of clothing range (women/men/all). It does not control scoring or clothing eligibility. Optional smaller/mid/fuller body reference gently affects ordering, not filtering or fit prediction. These are broad editorial silhouette references, not inferred measurements, sex or identity.
- The catalog has 23 women's and 19 men's clothing references; broad frame counts are women 13 smaller/6 mid/4 fuller and men 6 smaller/11 mid/2 fuller. Representation is incomplete, especially fuller-bodied full-outfit menswear. The UI discloses this rather than claiming balanced coverage.
- The first 16 observations prioritize breadth across clothing families, ranges, frames, contributors and feature exposure. Later affinity is bounded so exploration continues. Photos are pinned through draft editing and reload; stale/duplicate votes are rejected.
- Scores average outfit reactions within contributor groups, then across groups, with shrinkage and stronger explicit feedback. A contributor is a conservative shoot proxy, not an assertion that all photos are one shoot. Wear and admire counts are distinct; unsure adds no inferred positive/negative preference. Notes are stored, not interpreted by AI. Correlated tags, pose, setting and model remain confounds; no causal inference, confidence percentage or definitive type is claimed.
- Explicit exclusions filter references and favorites. Hidden footwear/bottoms fail closed when the related exclusion matters. Detail references are visibly labeled and only visible garments are tagged. Admired-only looks never become wear favorites. Suggested unvoted references are labeled as untested, not purchasable products.
- Real photographs never reshape. There is no virtual try-on, fabric simulation, retailer scraping, exact SKU matching or image generation.

## Compatibility and data

The original 24-look SVG app remains at `/illustrated`, using its unchanged `style-study:v1` storage. Photo sessions use `stylr:photos:v2`. Old reactions are never reassigned to different images or silently migrated. Original figures, budget-based search links and original downloads remain available there.

Both apps are account-free and keep personal data in browser localStorage. Different origins have separate storage. No analytics, server-side profiles or AI calls are part of the app. External source/license links open only on request; images/fonts are served from the app's own origin.

Drafts save with notes and detail feedback. Undo and filter changes that would replace a nonempty draft require confirmation. Web Locks serialize cross-tab saves; conflicts pause writing. Invalid/future versions remain protected, even after transient read failures. Reloading missing/unreadable storage never discards open work. Clear is serialized, blocks modal cancellation while pending, verifies deletion and detects competing changes. Failed writes/clear are reported, not silently called successful. Environments without Web Locks remain volatile and cannot safely clear through the app.

Markdown and JSON downloads are available; JSON includes optional sex and all settings. Markdown describes clothing/body choices but omits the sex value. JSON import is not implemented. In-app navigation protects pending or blocked saves; browser navigation has a before-unload warning. Force-closing a browser can still lose unsaved work; use the saving indicator and export important work. The lock coordinates this app, not arbitrary same-origin software ignoring that lock.

## Photo sources and licenses

`src/lib/photo-catalog.ts` contains creator credits, original source and license links, visible feature metadata and conservative garment-visibility flags. `scripts/photo-assets.json` contains the original download URLs. Copyright licenses are Pexels/Unsplash; these are not blanket verification of model/property releases or endorsement. See `docs/photo-sources.md` before changing how the images are used.

Licensed photos and photo-containing screenshots are not committed as a redistributable stock-image library. They are fetched locally into ignored `public/photos/` and served as part of the app. No stock-photo download, bulk export or image resale feature is provided. Credits accompany every displayed image. Source availability can change; the production build has its local copies, but fresh installs require the sources to remain reachable.

## Development and verification

Canonical workspace: `Sites/stylr`. The earlier `Sites/style-study` prototype is separate. Read `docs/plans/photo-study.md` for current scope; `docs/plans/stylr-completion.md` describes the original illustration release, not the current homepage.

Install and verify:

```sh
bun install --frozen-lockfile
python -m pip install Pillow
python scripts/fetch-photos.py
bun run typecheck
bun run test
bunx playwright install chromium
bun run test:browser
```

`CHROMIUM_PATH` optionally selects installed Chromium. By default browser tests serve actual production assets from `dist` via Playwright interception at `https://stylr.test`; no manual dev server is needed. Set `TEST_BASE_URL=https://stylr-hatsunemiku.zocomputer.io` to exercise the real public deployment with interception disabled. Both homepage and legacy route are covered. Tests include 320/390/768/1440 layouts, axe accessibility, photo loads, preserved original proportions, filters, drafts, gestures/repeated activation, missing/corrupt storage, conflicts, reset races and the original 800 SVG-render cases. Automated checks are not physical-device or screen-reader certification.

Photo screenshots are generated locally under `docs/verification/photos-*.png` (ignored); text evidence is in `docs/verification/photo-review.md`.

## Architecture

Bun + Hono server; Vite + React 19 + TypeScript, React Compiler. `src/App.tsx` chooses the homepage photo study or `/illustrated`. No custom personal-data backend endpoint.

- `src/lib/photo-types.ts`: photo and session contract
- `src/lib/photo-catalog.ts`: curated metadata, no private measurements
- `src/lib/photo-session.ts`: validation, selection, scoring, undo and notes
- `src/lib/use-photo-state.ts`: browser persistence and recovery
- `src/pages/photo-study.tsx`, `src/photo-study.css`: photo UI
- `src/pages/style-study.tsx`, `src/lib/style-engine.ts`, `src/lib/use-study.ts`, `src/components/FashionModel.tsx`: retained original app
- `src/theme.json`: palette source of truth; `zo-theme.ts` generates variables; don't duplicate palette values in global CSS
- `public/fonts/`: self-hosted Instrument Serif/DM Sans and their OFL licenses

Zo manages all development/publishing processes. Never manually start/restart the site or edit ports/entrypoints in `zosite.json`. Publishing is explicit via `publish_site`; GitHub pushes alone do not deploy. Private dev preview: https://zite-53955-hatsunemiku.zo.computer/ (not required for production).
