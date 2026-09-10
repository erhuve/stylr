# Stylr — color photography study

Active implementation plan, 2026-09-09 America/New_York. Supersedes the illustration-first experience described in stylr-completion.md; that document remains the legacy verification record. Current request: more real photos, color only, broad clothing/body/sex coverage, useful preference distinctions, public deployment with adversarial review.

## Product

- Homepage becomes a real-photography study. Existing illustrated app and its exact v1 storage stay accessible at /illustrated. New study uses its own v2 key; never copy old illustration votes onto unrelated photos or clear old data implicitly.
- Optional self-reported sex (female/male/intersex/prefer not to say) in setup, independent clothing-range choice (women/men/all), and optional broad visual body-reference preference. No sex inference from photographs, no sex/body-based style scoring, no height/weight/body-fat estimates. Broad photographed silhouette groupings are editorial references, not measurements or identity claims. Explain that limited body coverage is not fit prediction. Body preference affects ordering only, never exclusion.
- Color photographic assets only; no desaturation or shape manipulation. Original aspect ratios contained, full outfits distinguished from detail references. Visible-logo/graphic hold candidates excluded. Free-license source and creator credit displayed on every image. Commercial copyright license does not imply individual model-release verification. No model endorsement, negative personal judgments, sensitive body claims, or item-specific shopping claims.
- Distinguish fitted/loose, plain/pattern, muted/bright, texture, layering, formal/sporty, utility/romantic/edgy/vintage through independent tags, not a single stereotype. Broad initial exposure before adaptive selection; wear distinct from admire; pass not global body/sex dislike; unsure uninformative. Explain exposure and provisional evidence, do not invent a confidence percentage or definitive type. Detail shots provide only visible-feature tags.
- Preserve draft, undo confirmation, keyboard access, disabled-image vote guard, malformed storage recovery, cross-tab conflict detection, serialized reset, safe notes export. Exclusions and gallery filters work honestly, not silently discarded. No automatic profile questions based on looks.

## Verification / deployment

Unit tests: schema, deterministic votes/ordering, exposure-normalized evidence, filters, sex invariance, draft safety. Browser: desktop/mobile accessibility, image loads/failures, real setup/filter/portrait/undo/export/reset, legacy preservation, keyboard repeated activations. Separate read-only adversarial review with regression tests. Fetch origin immediately before committing/pushing. Public deploy via publish_site; verify actual public images and core flow. Retain live URL and old route for reversibility.

## Known limits to report

Free sources skew toward slim models. Improve clothing-range counts but do not claim population-representative or perfectly balanced body coverage. Body selection is a soft preference while sourcing improves. Larger-bodied menswear/full-outfit/sport examples remain a gap. No asserted shopping SKU, cloth composition, age, biological sex, or precise body dimensions from photography.
