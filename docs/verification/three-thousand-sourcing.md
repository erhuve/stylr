# Three-thousand-photo continuation

September 16, 2026. Started from `3732008` in the isolated catalog checkout after fetching origin and confirming current origin/main is included. The 5 p.m. scheduled run deferred without changing the dataset; its separate note in afternoon-sourcing.md is retained. Production, schedules, matching tolerances and application behavior are unchanged.

## Results

Directly reviewed 1,257 candidates on 58 numbered, image-bound contact sheets across twelve batches. The initial saved WEAR observations were completed rather than relabeled from source text. Eleven original-image enlargements checked ambiguous contours. Admission adds 1,116 photographs from 1,116 new source pages and excludes 141 candidates. Exclusions include groups, backs, collages/rendered imagery and near-repeated outfits/colorways. Every candidate has an authored observation and a compiled, hash-bound record; every admitted image also has a visible-presentation review.

Repository totals: **3,086 photographs, 202 complete three-axis references, 38 matches** for build 3 / shoulder balance 0 / waist 1. The original 385 photographs and all prior 1,585 expansion records remain unchanged. The complete expansion history now has 3,540 reviewed candidates, 2,701 admissions and 2,238 admitted source pages. The sourcing ledger indexes 2,889 sampled pages and 1,684 eligible-deferred URLs across 27 source groups.

| Batch suffix | Reviewed | Admitted |
| --- | ---: | ---: |
| 2200-wear-men | 479 | 460 |
| 2220-tokyo-retry | 91 | 69 |
| 2230-wear-women | 72 | 72 |
| 2250-tokyo-more | 74 | 68 |
| 2310-tokyo-more | 75 | 69 |
| 2320-tokyo-more | 59 | 52 |
| 2330-tokyo-more | 40 | 32 |
| 2340-tokyo-more | 78 | 66 |
| 2350-tokyo-more | 78 | 58 |
| 0000-tokyo-more | 80 | 58 |
| 0010-tokyo-more | 95 | 80 |
| 0020-tokyo-more | 36 | 32 |

The final three batch IDs use the September 17 sort prefix to keep append order; retrieval timestamps and review date record the actual September 16 session. Subsequent batches must sort after `2026-09-17T0020-tokyo-more`.

## What the labels support

378 new photos support apparent build, only two support all three axes. The two enlarged complete references are `tokyo-archive-182837` and `tokyo-archive-190430`, both build 2 / shoulder balance 0 / waist 1. Enlarged `wear-27276621` and `tokyo-archive-173712` support waist 1 but not shoulder/hip balance. Seven other enlarged views retain unknown axes; bomber construction, loose trousers, angled poses and bags prevent reliable contours. The broader-build example therefore remains at 38 rather than increasing with raw catalog size.

| Visible styling | Added photos | Repository photos | Complete references |
| --- | ---: | ---: | ---: |
| Masculine | 367 | 642 | 24 |
| Feminine | 347 | 1,438 | 108 |
| Mixed/androgynous | 82 | 112 | 2 |
| Unclear/neutral | 320 | 894 | 68 |

These are subjective AI outfit-presentation observations, not sex/gender identity, unique-person counts, measured anatomy or human-verified labels. Plain basics remain neutral even when selected from menswear listings. All previous presentation observations are unchanged. No research predictions or clustering outputs were promoted to labels.

## Search scope and limits

`research/catalog/collect_street_batch.py` uses explicit listing/archive pages, one image per post, full-resolution WEAR detail images and a default three-post WEAR account cap across prior sampled pages. Posting accounts are not verified individual people. Exact duplicate bytes and previously sampled source pages are skipped. Every inspected listing candidate and attempted image has a recorded decision/outcome; raw responses remain in the external corpus with recorded snapshot digests.

- WEAR menswear: successful saved listing pages 1–11, 479 candidates. The interrupted request originally named pages 1–15; unsaved pages are not claimed as inspected.
- WEAR womenswear: successful saved page 1, 72 candidates. A later pages 2–13 request returned regional-unavailability pages and yielded zero candidates. Its corrected failure log and response hashes are retained in sourcing/history, not counted as empty successful listings. No regional restriction was bypassed.
- Tokyo Fashion: successful saved archive pages 1–10, 20–22, 24–28, 30–32, 35–48, 50–54, 56 and 58. The original large requests were interrupted; their requested page lists exceed actual successful scopes. Later smaller bounded requests recovered useful progress without claiming unvisited pages.
- Tokyo timeout failures include 23, 29, 33, 34, 49, 55, 57 and 59, plus the initial zero-candidate attempt retained in sourcing/history. Four final-batch image downloads failed separately. Failure records are retry leads, not reviewed candidates or evidence of source exhaustion. A failed detached continuation produced no intake and contributes no sourcing claims.

The initial target favored menswear; actual intake included 479 WEAR-men candidates before availability changed, followed by mixed street-style coverage. Accounts were capped and visual repeats excluded, but models can recur across accounts, publishers and different outfits. No facial identity recognition is performed. Tokyo added many expressive outfits but few usable body contours. The batch does not establish balanced distinct-model coverage.

## Verification and handoff

Admission replay and exact hashes pass for all 3,086 assets. The original-photo visual identity check passes. Programmatic comparison against `3732008` preserves every earlier expansion record, asset manifest, body label, presentation review and catalog prefix exactly. Presentation audit has zero missing reviews, and source inventory is refreshed.

Typecheck passes. All 130 unit tests and all 86 browser checks pass against the isolated build; the latter took three minutes. After final collector hardening, all eight targeted sourcing/body tests also pass, including four Python street-collector fixtures. The first unit run exposed stale release-count assertions, which were updated without removing assertions. Street-collector tests exercise prior-page skips, no-image and deferred decisions, exact duplicates, download failures, WEAR account caps/full-resolution extraction, regional blocks, fresh image-directory creation and refusal to overwrite existing batches. No network requests are needed for these tests. All 54 successful listing snapshots match the retained raw-response hashes. `git diff --check` passes.

Future sourcing should prioritize fuller-build masculine full outfits with visible contours from additional publishers, not another count-only archive sweep. Masculine photo coverage improved from 275 to 642, while its complete-reference count remains 24. Keep all other presentation coverage and unknown axes intact. Read current presentation/source coverage and saved queues before the next run. Deployment is pending: the documented private live release remains 1,707 photos, 195 complete references and 33 example matches; this run did not re-verify or alter production.
