# Source-reported model heights

This is a separate reviewed provenance layer, not a measurement or a visual body label. Height must never be inferred from a photograph, brand sizing, a lookalike or another image of an apparently similar person. Unknowns stay eligible; a requested height is only a gentle ranking preference.

## Seed scope and result

The bounded September 19, 2026 pass inspected eight retained listing snapshots, up to 250 products per snapshot (1,765 products total). Fifty-five complete-body candidate observations from those listings remain unknown. It then retrieved five already-admitted product pages with `read_webpage`, covering eight photo IDs, six with all three reviewed body axes. One exact-image caption was verified; seven photo IDs on four pages remain unknown. No retrieval failed; this is not an exhaustive search or a count of distinct people.

The sole accepted photo is `ashanderie-9931920081194-image-50448391471402`: Ash & Erie reports Drew as `5'8"`, normalized to 172.72 cm. Both copies of gallery slide 0 bind the named-model caption to the exact versioned admitted Shopify image. The accompanying `15.5" Standard` is shirt sizing, not another height. Nothing is transferred to other gallery images. The photo has all three reviewed body axes. Source-reported does not mean independently measured or accurate.

## Files and verification

- `review.json`: immutable application claims, exact admitted image SHA-256, source quote/URL/retrieval time, original height unit/value, normalization and exact gallery identification.
- `search-log.json`: bounded scope, saved-snapshot hashes, candidate decisions, page retrievals, unknowns and failures. Historical listing snapshots remain under the recorded Documents paths.
- `snapshots/*.html.gz`: all five fetched HTML extraction snapshots, including unknown outcomes. Digests refer to **decompressed HTML bytes**. These are read_webpage extraction snapshots, not raw HTTP archives.
- `../../scripts/audit-model-heights.ts`: offline audit; run `bun scripts/audit-model-heights.ts` from the repository root. It checks the actual admitted WebP bytes and retained HTML digests, then extracts exact gallery associations. It performs no network requests.
- Run bounded tests with `bun test tests/height-reference.test.ts`.

Future batches must record an explicit bound and every inspected candidate's outcome. Retain the source snapshot before authoring a claim. Capture a singular, explicit model-height caption linked to the exact admitted image, preserving original units, exact quote, retrieval time and identification rationale. Product-wide multi-model descriptions are insufficient. Never mark an unresolved candidate verified to improve coverage.

The current extractor intentionally supports only `.product-main-slide[data-index]` images with their own `.model-info--custom` caption. A new publisher/alt-text format needs a separately tested exact-image extractor; do not relax this into page-wide text matching. Numeric claims support cm and feet/inches only; ambiguous ranges, approximation and conflicting statements fail closed. Before using records in a release, the audit must pass; browser code validates static schema and admitted-manifest bindings but does not rehash images or HTML at runtime.

The shared API exports `MIN_HEIGHT_CM`, `MAX_HEIGHT_CM`, `getReportedHeight` and `heightSimilarity`; invalid or missing requested heights and unknown photos score zero. Verified similarity is `max(0, 1 - abs(referenceCm - requestedCm) / 15)`. The app stores optional height and unit preferences in backward-compatible v2 sessions, adds at most 12 points to discovery ranking and a 0.12 distance preference to body previews, and displays reported-height source links. Height never changes eligibility or required body-filter tolerances.
