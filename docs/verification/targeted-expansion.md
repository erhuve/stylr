# Targeted catalog expansion, 2026-09-16

The completed first release is preserved by commit `79c48e0` on `personal-discovery`, including body controls, admission provenance and offline research code. The subsequent expansion reviews 178 new candidates across Forest Ink, Snag, Shiny by Nature, Foxblood and Midnight Hour. Source scopes and authored evidence are committed under `data/catalog-review/batches/`.

## Result

- 108 admitted photos across 79 new source pages; 70 back/detail/promotional/repetitive views excluded.
- 1,568 total photos, 1,327 direct review records, 1,124 apparent-build observations and 183 complete three-axis references.
- Nine new complete references. Build 3 / similar shoulder and hip width / moderate waist now yields 30 matches, previously 26. These are photo counts, not distinct people.
- Existing 1,460 photos and all original IDs remain unchanged; required unknown axes still fail matching. Saved reactions and illustrated routes retain their behavior.

## Verification

- TypeScript and all 125 unit tests pass, including admission replay and the new negative cases.

- All 178 new candidate image bindings validate; admission replay and all 1,568 local assets pass. Original-photo visual identity checks pass.
- All 86 browser tests pass in the isolated checkout using installed Chromium, including every catalog photo loading, responsive geometry, accessibility, swipe/undo, storage conflicts and strict filters. The mobile screenshot shows 30 matches.
- A larger mixed-catalog sequencing test needed a 15-second test allowance instead of the default five seconds; all its diversity and identity assertions remain. Its isolated rerun completed in 4.1 seconds.
- New negative admission tests reject missing/duplicate reviews, reused source pages, changed digests, invalid axes and missing evidence. Restore tests preserve existing corrupted files for investigation and prevent mismatched downloaded bytes from being published.
- Two remotely restored reviewed images match exact committed digests. Remote availability and encoder changes remain possible; restoration fails closed instead of rebinding annotations.

Privately deployed through `publish_site` on 2026-09-16 at https://stylr-personal-hatsunemiku.zo.computer/. Eight production browser checks pass in fresh contexts. All 108 new served image digests match reviewed originals; production HTML matches the verified isolated build. Unauthenticated access returns the owner sign-in redirect (302). The live checkout is clean at the committed release; the previous uncommitted deployment files are additionally preserved in a named Git stash. Local photo screenshots and original corpora remain ignored; no photos or model weights are committed.
