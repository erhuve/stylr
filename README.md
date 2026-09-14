# Stylr — personal discovery

A personal-style discovery experiment: real outfit photos, one at a time, with quick swiping and no required questionnaire.

**Active workspace:** `Sites/stylr-personal`, branch `personal-discovery`, https://github.com/erhuve/stylr. Open this Site in Zo for its owner-only development preview. It is not published. `Sites/stylr` is the separate working directory for the previous public release; do not use it for this iteration or run test builds there.

Read `docs/plans/personal-discovery.md` for the active scope and `docs/verification/personal-discovery.md` for verification and coverage. Earlier plans describe earlier iterations, not additional requirements for this experiment.

## Trying it

Preview status (2026-09-14): the implementation and saved production build are verified, committed and pushed. The managed dev runtime stopped during host restarts; reopen this Site in Zo and verify the live page. See the verification report for the exact checks and remaining runtime step. Do not manually start a server or overwrite the project to recover it.

Click **Start with real outfits**. Swipe right to wear, left to pass; buttons also support **Admire, not for me**, **Not sure**, and undo. Keyboard alternatives are available. Notes, explicit more/less feedback and settings are optional disclosures. Essential photo controls fit at 320×640 and larger tested viewports.

The library contains **385 color references**: the original 42 unchanged photographs, 237 reviewed Fashionpedia archive references, and 106 TokyoFashion street-style outfits. There are 366 full-outfit images and 19 labeled detail views. The source assets occupy 37.4 MB locally; the interface preloads only the current and two upcoming images.

Eight optional metadata groups describe silhouette, surface, palette, styling, references, context, function and visible comfort cues. Roomy silhouettes and flat footwear are visible cues, not proof of softness, stretch, breathability, comfort or fit. There is no comfort questionnaire or inferred tactile performance.

Most new references have **unclassified clothing range** and **unknown body reference**. Use **All looks** for the full library. Choosing a narrower clothing range intentionally excludes unclassified references. Coverage is not balanced: larger-body references, everyday activewear and ordinary menswear remain thinner than expressive street style and runway imagery.

## Discovery behavior

- The first 16 observations favor breadth. Related exploration subsequently occupies one in three slots, while the others continue exploring.
- Missing metadata is unknown, not a dislike or a reason to exclude an outfit. Annotation completeness cannot monopolize the sequence.
- Contributor/shoot grouping conservatively limits repeated evidence. A publisher label does not establish a shared person or shoot. Extra dimension tags do not erase an existing cross-group association.
- Wear, admiration, pass and unsure remain distinct. Explicit more/less feedback is stronger than inferred affinity. Notes are stored, not interpreted by AI.
- The result is a photo-first moodboard. Saved wear/admire references remain distinct from untried suggestions; evidence and downloads are under Style notes. There are no definitive style labels, shopping matches, fit prediction or virtual try-on.

## Persistence and boundaries

Photo sessions retain `stylr:photos:v2`; the original illustrated application remains at `/illustrated` with its unchanged `style-study:v1` storage. All 42 original IDs still identify their original photographs. Draft identity, notes, feedback, undo, exclusions and existing history are preserved by the new implementation.

Both applications use browser localStorage, with no accounts, analytics, AI calls or personal-data backend. **Origins have separate storage:** this private preview does not automatically copy a session from the public site. JSON import is not implemented. JSON downloads include optional profile choices and notes; Markdown omits the optional sex value.

Optional self-reported sex never changes photo eligibility or scores. Body reference only gently affects order. Exclusions fail closed when the relevant shoes or lower garments cannot be seen. Filters and undo ask before replacing a nonempty draft.

Web Locks coordinate saves across tabs. Conflicts, unreadable/future data, read/write failures, clear races and environments without Web Locks retain the existing protection and warning behavior. Unsaved browser closure is not guaranteed safe; important work should be exported. Personal data never enters the Git repository.

## Photo records

Source links, credits, local asset manifests and review notes are retained so a reference can be inspected and reproduced. This iteration adds no licensing or commercialization workflow. Historical source documentation does not expand the personal-use scope.

- `scripts/photo-assets.json`: original 42 source assets.
- `scripts/fashionpedia-photos.json`, `fashionpedia-assets.json`, `fashionpedia-review.json`: reviewed archive metadata, exact ZIP-member sources and admission notes.
- `scripts/streetstyle-photos.json`, `streetstyle-assets.json`, `streetstyle-import.py`: street-style metadata, sources and validated importer.
- `public/photos/`: same-origin optimized WebP files, ignored by Git. Photo-containing verification screenshots are also local artifacts rather than repository assets.

`fetch-photos.py` downloads only missing files, verifies archive member hashes and supports `--check`. Its archive fallback needs a roughly 226 MB download on a fresh machine; source availability can change. No original image assets were overwritten during this expansion.

## Verification

```sh
bun install --frozen-lockfile
python -m pip install Pillow
python scripts/fetch-photos.py
python scripts/fetch-photos.py --check
python scripts/check-original-photos.py
python scripts/streetstyle-import.py self-test
python scripts/streetstyle-import.py validate --check-images
bun scripts/audit-library.ts
bun run typecheck
bun run test
bunx playwright install chromium
bun run test:browser
```

`CHROMIUM_PATH` can select installed Chromium. Browser tests intercept the built files from `dist` at `https://stylr.test`; no manually started server is needed. Run them in this private Site, not the published working directory. `TEST_BASE_URL` disables that interception for deliberate endpoint checks; do not point the suite at a shared browser session containing personal data.

Automated coverage includes responsive geometry, accessibility checks, actual mouse/touch gestures, keyboard/reduced-motion behavior, chorded buttons and cancellation, failed/late image loads, bounded preloading, duplicate input, exact legacy identity, storage failures/conflicts, draft protection, long selection sequences and the original illustrated application. These checks are not physical-device or screen-reader certification.

## Architecture

Bun + Hono, Vite, React 19, TypeScript and React Compiler. No new dependencies were required for swiping or sequencing.

- `src/lib/photo-types.ts`: backward-compatible photo/session contract.
- `src/lib/photo-catalog.ts`: immutable combined catalog; original metadata stays separate as `LEGACY_PHOTOS`.
- `src/lib/photo-dimensions.ts`: bounded descriptive metadata normalization.
- `src/lib/photo-session.ts`: validation, sequencing, bounded caches, scoring and undo.
- `src/lib/use-photo-state.ts`: browser persistence and recovery.
- `src/components/SwipePhoto.tsx`: guarded pointer/button/keyboard interaction.
- `src/pages/photo-study.tsx`, `src/photo-study.css`: photo UI and optional disclosures.
- `src/components/PhotoMoodboard.tsx`: source-aware moodboard and evidence.
- `src/theme.json`: palette source of truth.

Zo manages Site processes. Do not manually launch the development entrypoint or change managed ports. Publishing requires an explicit request. The existing published Site builds from its own working directory on startup, so keeping that directory separate and unchanged is important; GitHub pushes alone are not a deployment.
