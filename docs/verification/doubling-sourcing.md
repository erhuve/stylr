# Doubling the reviewed library

Date: 2026-09-17. Status: in progress, not deployed. Baseline: `872e892`, 5,106 photos. Requested target: 10,212 admitted photos, not downloaded candidates. Current checkpoint: 6,747 photos; 3,465 further admissions required. This document is the active continuation handoff; older verification documents describe earlier checkpoints.

## Training prefix continuation

The first 720 training candidates are reviewed: 288 observations resumed from the previous session and 432 newly inspected. Thirty bound overview sheets and eleven enlarged checks yield 624 admissions, 594 build observations and two complete references. Presentation additions: 149 masculine, 267 feminine, eight mixed and 200 unclear; neither complete reference is masculine. Current totals: 6,747 photos, 6,506 body records, 5,268 build observations and 285 complete references. The broader-build benchmark remains 54. Fourteen of 45 sampled settings improve relative to the 5,106-photo baseline; 12 still have no matches.

All earlier catalog, asset, body and presentation rows are preserved. The source ledger now records 11,394 sampled pages, 40,364 deferred pages and 41 runs across 43 source keys. The new large deferred queue comes from the recorded training metadata snapshot, not an exhaustive contemporary web search. Source-page and photograph counts do not establish distinct people.

Batch `0540-training/pending-intake.json` preserves 4,080 unreviewed originals starting at collection ordinal 720. A later continuation must move reviewed rows into a new batch and remove those exact rows from this pending file, preserving the collection ordinal offset for sheet references. Do not overwrite the external intake or label the pending rows as rejects. The following checkpoint table and validation paragraph describe the earlier verified 6,123-photo release; current validation is recorded separately below.

## Reviewed checkpoint

| Batch | Candidates visually reviewed | Admitted | Complete body references |
| --- | ---: | ---: | ---: |
| `2026-09-17T0500-inclusive` | 171 | 55 | 8 |
| `2026-09-17T0510-street` | 200 | 139 | 0 |
| `2026-09-17T0520-archive` | 831 | 767 | 12 |
| `2026-09-17T0530-contours` | 305 | 56 | 2 |
| Total | 1,507 | 1,017 | 22 |

Every candidate has an individually authored view/body observation and every admitted photo has image-bound presentation evidence. Unknown axes remain null. Repeated outfits/colorways, groups, backs and product-detail views are excluded. Enlarged contour checks are recorded alongside the relevant batches. Body labels are approximate AI visual judgments, not measurements or human-verified annotations; presentation describes clothing, never gender identity.

The 831 previously pending validation/test archive images have now been fully reviewed in `0520-archive`. Its intake preserves the exact old pending records; the old pending array is empty. Source retrieval metadata still refers to the original snapshot, not an invented new download.

Current catalog: 6,123 photos; 5,882 body records, 4,674 with apparent build, 283 complete three-axis references. The build 3 / shoulderHip 0 / waist 1 nearby benchmark rises from 52 to 54. It is not the user's confirmed selection. Presentation: 985 masculine, 3,555 feminine, 153 mixed, 1,430 unclear; complete references respectively 40, 145, 2 and 96. Extensive coverage of both presentations remains incomplete, especially fuller-build masculine contours.

The sourcing ledger records 6,594 sampled pages, 2,733 deferred pages, 43 source keys and 40 recorded runs at this checkpoint. Recorded scope is bounded; unavailable endpoints and one Tokyo timeout are not source exhaustion. Publisher, page and photograph counts are not distinct-person counts.

## Preservation and validation

The 4,721 prior expansion asset, photo and body records compare exactly as unchanged prefixes against `872e892`; original 385 photographs remain separate and untouched. Admission replay, all 6,123 local image digests/formats, all-photo presentation coverage, six focused archive tests, typechecking, all 131 unit tests and all 86 browser checks pass. `doubling-body-grid.json` records improvement at 12 of 45 sampled settings; 12 remain empty. No application matching behavior, reactions, ordering rules or storage contracts have changed.

The collector additionally supports the official training archive with `--split training`, retaining individual Flickr URLs, original archive/member digests and licenses. Its attributes never supply body or presentation labels. Archive restoration streams bounded downloads to disk so the 3.34 GB training ZIP does not require a matching in-memory allocation. The default validation/test collection behavior remains unchanged.

## Next intake

The training archive and metadata are downloaded under external corpus folder `expansion-2026-09-17T0540-training/raw`. Collection produced 4,800 unique, individually sourced images; the first 720 are reviewed and 4,080 remain pending as described above. Do not interpret downloads as reviews. Inspect every subsequent candidate, author observations, reject repeated outfits and ambiguous/multi-person views, recheck contour candidates enlarged, and record each admission's presentation.

Continue targeted full-front masculine/fuller-build sourcing alongside archive breadth. Retail first/third galleries produced many trouser crops, flat products and repeated tees. The supplemental gallery manifest in `0530-contours` records alternate positions that actually yielded full outfits. The archive primarily broadens smaller-build/feminine styling; it does not by itself solve body-filter gaps.

## Current checkpoint validation

At 6,747 photos, admission replay, all image digests, original-photo visual identity, library audit, complete presentation coverage, typechecking and all 86 browser checks pass. The raw training ZIP and annotation snapshot digests match their saved provenance. The 720/4,080 intake partition exactly reproduces the immutable 4,800-row collection; every pending ID remains excluded, and all 30 reviewed sheet bindings validate. Earlier photo/asset/body prefixes and presentation rows remain unchanged.

The unit suite passed 130 checks; exhaustive full-catalog sequencing exceeded its 300-second limit during the concurrent browser run. With a 600-second allowance and every assertion retained, its focused rerun passes in 262.76 seconds. All 131 unit checks therefore pass across the full run and focused rerun. All 45 coverage positions also agree directly with the application's matching implementation. No matching or admission behavior changed.

## Deployment status

Not deployed. The last verified private live release remains 3,139 photos, 202 complete references and 38 benchmark matches. Do not rebuild or edit `Sites/stylr-personal` during sourcing. Publish only as a separate verified release.
