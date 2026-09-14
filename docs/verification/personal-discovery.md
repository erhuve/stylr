# Stylr personal discovery — verification

2026-09-14. Implementation and local verification complete on `personal-discovery` in `erhuve/stylr`.

## Result

385 distinct local photographs: all 42 original references retained, 237 visually reviewed fashion-archive additions and 106 reviewed TokyoFashion street-style additions. There are 366 full-outfit and 19 explicitly labeled detail references. Assets total 37,410,416 bytes; manifest/catalog IDs are bijective and no exact image duplicate was found.

The UI starts without a questionnaire. Right swipe means wear, left means pass; wear/pass/admire/unsure buttons and undo remain available. Notes and explicit more/less feedback are secondary disclosures. Comfort is represented through visible cues, not upfront questions or claims about how a material feels.

## Coverage

| Dimension | Photos with reviewed/source-described metadata |
| --- | ---: |
| Silhouette | 332 |
| Surface / visible material appearance | 252 |
| Palette | 316 |
| Styling / layering | 235 |
| References / influences | 150 |
| Context | 343 |
| Function | 122 |
| Visible comfort cues | 145 |

These are overlapping, optional annotations—not eight independently measured properties for every photo. The original 42 references deliberately keep their old metadata. Family totals are everyday 64, expressive 144, soft 36, sport 23, tailoring 85 and utility 33. A neutral first-40 walk covers all six families, with 5–9 cards per family, and includes both archives and the original selection.

Coverage remains uneven. 317 clothing ranges and all 343 new body references are unclassified/unknown. Only six original references carry the broad fuller-frame label. Performance/athletic clothing and broader body representation remain thin; runway/editorial and Harajuku-specific styles are prominent. Metadata density, labels and photo count are not proof of comprehensive personal-style coverage. Choose All looks for the widest library; strict clothing selections remain strict.

## Adversarial findings resolved

1. **Sparse metadata was starved by annotation-rich entries.** Added diminishing uncertainty-aware exploration, reduced metadata-volume rewards, and retained contributor diversity. The reproduced sparse cohort now appears immediately and continues through later windows rather than waiting until card 161.
2. **An extra descriptive value could erase a learned combination.** Associations now use bounded, overlap-aware group pairs from the same observed outfit, rather than whole-array serialization. Separate-outfit marginals do not fabricate co-occurrence. Mutable/frozen cache invalidation and contribution caps are covered.
3. **Chorded mouse buttons could complete an accidental swipe.** Additional pressed buttons and context-menu activation now cancel the gesture. Both primary-button release orders are browser-tested.
4. **The existing public Site builds directly from its working directory.** Moved this iteration to a separate, unpublished Site at `Sites/stylr-personal`. Restored `Sites/stylr` to `origin/main` baseline `160d070` and restored its matching public bundle. Future personal test builds run only in the isolated directory.

## Checks

- `bun run typecheck`: passed.
- `bun run test`: **119 passed**, zero failures; original illustration, persistence, source-schema, immutable identity, sequence and cache regressions included.
- `CHROMIUM_PATH=/root/.cache/ms-playwright/chromium-1169/chrome-linux/chrome bun run test:browser`: **82 passed**, zero failures, against the actual production build via Playwright request interception.
- `python scripts/fetch-photos.py --check`: **385** source-linked WebP assets verified.
- `python scripts/check-original-photos.py`: **42** original visual identities preserved. An additional local SHA-256 comparison confirms all 42 retained files are byte-for-byte unchanged. The portable visual check also passed with freshly regenerated originals.
- Street importer self-tests: **8 passed**; 106 catalog/manifest entries and image validation passed.
- `bun scripts/audit-library.ts`: full coverage and neutral-sequence audit passed; zero exact duplicate assets.
- `git diff --check`: passed before commit.

Browser coverage includes 320×640, 390×844, 768×1024 and 1440×900; essential controls above the fold; real mouse and touch swipes; cancelled/reversed/multitouch gestures; reduced motion; keyboard focus; duplicate activation; failed and stale image events; preloading; exact draft/undo restoration; storage denial, corruption, conflict and reset races; original-route behavior; and axe accessibility checks. These are automated browser tests, not physical-device or screen-reader certification.

## Screenshots and preview

Local ignored screenshots: `photos-swipe-320x640.png`, `photos-swipe-390x844.png`, `photos-swipe-768x1024.png`, `photos-swipe-1440x900.png`, plus setup, moodboard and portrait screenshots in this directory. `photos-personal-mobile.png` was also captured from the actual managed private dev server.

The implementation was committed as `f69d060` and pushed to `origin/personal-discovery`. After a subsequent host restart, six focused tests were rerun against the saved production build: all four viewport checks plus real mouse and touch gestures passed; the four `photos-swipe-*` screenshots above are from that run.

**Remaining runtime check:** the managed private dev server stopped during host restarts. A live-server swipe run encountered an unresponsive/stale runtime and was stopped; it is not counted as passing. The latest direct preview check found no listener on the assigned port. Reopen `Sites/stylr-personal` in Zo to request the managed preview, then verify the live page. Do not manually start an entrypoint, overwrite the project, or publish without approval. The source and saved build remain intact and independently browser-verified.

The Site remains unpublished. The previous public URL was checked against the restored baseline bundle (`index-B9zEd6yH.js`), and its working directory is clean. Different browser origins have separate localStorage; this build retains the v2 format and image identities but does not move another origin's browser data automatically.
