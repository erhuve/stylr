# Real-photo body-reference labeling

Completed 2026-09-14. Scope: all 385 real photographs in the current Stylr personal catalog. This is an annotation dataset and audit tooling, not a deployed body-filter interface. No generated images, image reshaping, source-photo changes, session changes or service changes.

## Result

| Supported visual axis | Photos | Unknown |
|---|---:|---:|
| Overall visible build | 39 | 346 |
| Shoulder-to-hip balance | 10 | 375 |
| Waist definition | 6 | 379 |
| Leg-to-torso proportions | 0 | 385 |

**42 photos have at least one supported axis; 343 have all four unknown. No photo supports a complete four-axis profile.** Counts overlap across axes. Only seven photographs support build and shoulder-to-hip balance together; six support build and waist; three support shoulder-to-hip balance and waist. These totals describe support under the documented conservative visual rubric, not measured anatomical truth or a calibrated estimate of annotation accuracy.

All retained numeric observations have medium confidence and use broad ordinal anchors. Most build support is narrow/intermediate; the fuller end remains sparse. A complete catalog of annotation records is not the same as a complete catalog of body references.

## Review performed

1. Five primary visual-labeling batches covered 77 photographs each. Their final records, rather than interim snapshots, are preserved in `data/body-references/primary-observations.v1.json`.
2. A second-pass review checked both unsupported numeric inferences and missed support. The parent reviewed 19 initially numeric candidates; one was subsequently cleared by its primary reviewer. A blind 72-photo unknown sample revealed missed labels, so review was extended to the rest of the library instead of extrapolating from that sample.
3. Two further blind batches covered 98 photos each. An interrupted third batch actually covered only 72, not the requested 98: its mapping was missing after a host interruption. The parent reconstructed the remaining 26 assignments, verified they were disjoint, and inspected all five recovered sheets. Those 26 remain unknown under the rubric.
4. The union of the second-pass IDs is exactly the 385 catalog IDs. The 25 proposed additions were adjudicated against image pixels. Singleton array encodings were normalized to two-endpoint intervals; the build interval for `archive-15108` was widened to `[1,2]` after inspecting its original-sized image.
5. A leg-proportion inference for `street-tokyo-195901` was rejected: the trouser rise is not a reliable anatomical landmark, and the loose top conceals the torso relationship. `archive-19120` received a corrected slight-to-moderate waist interval `[1,2]` rather than almost no indentation.

The 27 final replacements and before/after records are preserved in `data/body-references/adjudication.v1.json`. Reviewer output was not applied blindly. The parent used contact sheets and lossless RGB renderings for closer inspection; this processing did not alter source photographs. These are AI-assisted visual observations, not a human measurement study.

## What this means for the requested interface

The existing library is not sufficient for strict, rich body matching. Showing sliders now and treating hidden traits as matches would create false precision or silently ignore the preference. Even accepting any value on all four axes gives zero supported complete matches.

The next useful data work is targeted **real reference sets**, with clearer torso/hip contours, near-frontal neutral poses and flat footwear, spanning more builds and shapes. Where stable source provenance explicitly establishes that multiple outfits show the same person, a body-readable reference could later support that person's otherwise obscuring outfits. That linkage would need its own evidence; this pass does not identify people from faces or propagate labels between photographs.

Retain the intended product direction: body preferences front and center, visual shape/size adjustment, and explicit empty states rather than substituting mismatching photos. Generated augmentation remains deferred. The current deployed frame categories and soft ordering have not been changed by this labeling branch.

## Files and validation

- `data/body-references/labels.v1.json`: one source- and image-digest-bound record per photograph, including independent unknowns and evidence.
- `data/body-references/coverage.v1.json`: machine-derived support counts, combinations and confound counts.
- `data/body-references/primary-observations.v1.json` and `adjudication.v1.json`: reproducible review history.
- `docs/body-references/annotation-protocol.md`: anchors, evidence requirements and excluded inferences.
- `scripts/body-references/annotations.ts`: strict schema, validation, coverage and an offline matching check. Not imported by the application.
- `scripts/body-references/audit.ts`: read-only validation/reporting, plus explicit artifact assembly.

Run from this isolated checkout:

```bash
bun run typecheck
bun run test
bun scripts/body-references/audit.ts validate
bun scripts/body-references/audit.ts report
```

Unknown selected axes never pass the offline matching check. That check requires the entire supported interval to fit inside the requested interval; it does not turn uncertain observations into point estimates. An empty preference object is not counted as body-matching evidence. The validator rejects missing/duplicate/stale records, non-finite or malformed ranges, fabricated completeness and unrecognized fields.

Image-byte changes invalidate the binding even if they result from re-encoding. A reviewer must verify or rebind such assets; do not silently retain stale labels. No browser build is needed for this data-only pass. Both live Site directories and their read-only linked assets/dependencies remain untouched.

## Verified results

- `bun run typecheck`: passed.
- `bun run test`: **135 tests passed, 0 failures, 11,696 assertions**, including 16 annotation/dataset tests and the existing application regressions.
- `bun scripts/body-references/audit.ts validate`: all 385 source URLs and exact local image-byte digests matched; no missing or duplicate IDs.
- Regression tests replay every adjudication to the final dataset, recompute the coverage report, and verify unknown traits cannot pass strict matching.
- No application source, original image, session format, browser build or deployment changed. Browser tests were not rerun for this label-only pass.
