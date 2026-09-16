# Stylr — personal discovery expansion

## Body-reference controls, 2026-09-14

Latest UX revision supersedes optional axis checkboxes and discrete sliders: three required continuous values, clear spectrum endpoints, one responsive silhouette, and distance-sorted real-photo previews. New `nearby` matching excludes unknowns and uses fixed proximity limits (build 0.5, shoulder/hip and waist 0.75). All three values apply on Start, with confirmation before replacing a dirty draft. Legacy exact optional filters still load unchanged. A smooth figure is not evidence of continuous measurement precision; photo changes are limited by reviewed coverage. Fem/masc presentation is deferred pending a rubric and annotations.

The latest requested extension puts reviewed real-photo body preferences on the starting screen. Apparent-build, shoulder/hip and waist sliders strictly filter the swipe queue, previews, library and moodboard; each axis can remain unrestricted. Unknown selected traits never match, and empty selections never widen silently. All saved reactions remain stored even when filters hide them. Existing v2 sessions, draft protection, undo, source photo identities and the illustrated study are preserved. This supersedes the earlier gentle frame preference and hidden body setup. The copied second-iteration observations and provenance live in `data/apparent-build`; no generated images or algorithm predictions are admitted. Pre-release builds run in `Code/stylr-body-controls`, then the authorized deployment updates only `Sites/stylr-personal` through private publishing.

Status: implemented, verified and privately deployed with approval, 2026-09-14 (America/New_York). Owner-only URL: https://stylr-personal-hatsunemiku.zo.computer/. Six live-production smoke tests passed. Active iteration: `Sites/stylr-personal`, branch `personal-discovery`. Results and limitations: `docs/verification/personal-discovery.md`.

This is the active plan for the personal-use expansion. It supersedes the sourcing constraints and discovery UX in `photo-study.md`, not its persistence/accessibility safeguards. The previous public release remains isolated and unchanged in `Sites/stylr`; the personal iteration is now privately published from `Sites/stylr-personal` after the user's explicit deployment request. No new accounts, analytics, questionnaire, shopping, licensing workflow, or definitive style classification.

## Outcome

A reviewed library of 300–500 distinct real color outfit photographs, a large single-photo swipe surface, immediate start, optional secondary feedback, and a varied sequence that alternates breadth with related exploration. Comfort and function are represented in the library, not upfront questions. Do not infer tactile softness, stretch, breathability, or fit from a photograph.

## Workstreams

1. **Corpus and ingestion:** preserve all original 42 image IDs/assets and metadata; add fashion-specific sources, portable source records, optimized same-origin assets, deduplication, contact sheets, and coverage reporting. Review images before admission. Prefer a complete, identifiable outfit; keep detail views explicitly labeled. Honest unknowns for body reference and clothing range. Avoid substituting photo count for visual diversity.
2. **Dimensions and sequencing:** optional grouped metadata on Photo, separate from existing persisted Feature feedback. Groups: silhouette, surface, palette, styling, references, context, function, comfort. Values describe observed appearance/source descriptions; no invented physical performance. Efficient selection with broad initial exposure, bounded related exploration, continuing novelty, contributor/near-duplicate suppression. Preserve existing v2 save semantics and explicit feedback.
3. **Swipe-first UI:** right wear, left pass; buttons for wear/pass/admire/unsure and undo; robust pointer cancellation, image-ready guards, no double voting, reduced motion, keyboard alternatives. Photo and essential controls above the fold at 320×640 and larger. Preload a small number of upcoming photos. Secondary notes/attributes/settings use progressive disclosure. Existing setup values remain accessible but never required.
4. **Verification:** unit, browser, migration/persistence and sequence tests, coverage/asset checks, screenshots of real preview, independent adversarial code/UX and corpus review. Resolve actionable findings and rerun affected tests. Commit/push with required attribution only after refetch/integration. Git push does not deploy.

## Data contract

Existing Photo fields and the v2 reaction/feedback schema retain their meaning. New optional Photo fields: `dimensions` (partial record of eight groups to descriptive string arrays); `sourceLabel` (display credit/archive); `metadataBasis` (`visual-review`, `source-description`, or `legacy-tags`). Photo collection may also be `unclassified`; frame may also be `unknown`. These are not new profile choices. Strict selected clothing filters exclude unclassified items; all looks includes them. Missing dimensions are unknown, not negative evidence. Original sessions continue to parse, and original photo IDs never refer to another image.

## Acceptance

- 300–500 locally available reviewed outfit references with source URLs, no duplicate assets/duplicate outfit padding, and an explicit coverage report documenting gaps.
- Comfort represented by observable cues such as room through the body, exposed adjustable closures, flat footwear; performance unknown unless sourced. No comfort questionnaire.
- Fast first-card start and stable touch/keyboard/button behavior with reload, undo, failed-image recovery and existing localStorage protection intact.
- Legacy `/illustrated` and photo-first moodboard preserved.
- Verified private production deployment; public deployment unchanged.

## Completion

The implementation is committed and pushed on `personal-discovery`, with 119 unit tests, 82 browser tests and asset checks passing. The former development-runtime blocker is resolved for personal use by the approved private production deployment: six live-production checks passed, and unauthenticated requests redirect to Zo sign-in. The previous public release remains separate and unchanged. No deployment blocker remains; coverage limitations and the separation of browser storage across origins remain documented in README.md and the verification report.
