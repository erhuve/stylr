# Five-thousand-photo sourcing continuation

2026-09-17. Repository admission: 5,059 photos, up from 3,139. Deployment is pending; no live checkout or service was changed. Last verified production remains the 3,139-photo release described in `postdeploy-sourcing.md`.

## Reviewed batches

| Batch suffix | Candidates reviewed | Admitted photos | Build observations | Complete references |
| --- | ---: | ---: | ---: | ---: |
| 0040-afternoon-final | 143 | 52 | 52 | 1 |
| 0300-contours | 459 | 91 | 91 | 28 |
| 0310-breadth | 758 | 278 | 268 | 4 |
| 0320-fashionpedia | 1,632 | 1,499 | 1,361 | 20 |
| Total additions | 2,992 | 1,920 | 1,772 | 53 |

Batch directories are under `data/catalog-review/batches/2026-09-17T...`. Corresponding original intake folders are under `/home/workspace/Documents/stylr-catalog-pilot/expansion-2026-09-17T...`. Earlier authored work was retained. This continuation finished the unsaved breadth suffix (ordinals 576–757), enlarged five retail contour candidates and directly reviewed 34 numbered 48-image archive sheets (ordinals 0–1,631), followed by 42 enlarged contour checks. Each observation is bound to the exact original WebP digest. These are same-assistant visual judgments, not independent human verification.

The breadth recheck removed unsupported shoulder/waist labels from ordinal 277: satin drape and torso angle prevented a reliable comparison. Four complete retail references remained. Archive `contour-recheck.tsv` records both supported axes and reasons for leaving axes unknown. Structured bodices, peplums, loose trousers, full skirts and turned poses did not receive inferred contour labels. Repeated outfits/angles, rear views, distant subjects, product details and uncertain synthetic imagery were excluded where recorded. Dataset attributes and models never supplied body labels.

The low-chroma audit enlarged retail ordinals 288 and 658. Both retain visible skin/lip color; ordinal 288 additionally has red nails against an almost entirely black-and-white coat/background. Their original bytes are unchanged. The browser color check retains its global threshold and adds only ordinal 288's exact image ID to the existing reviewed low-chroma exception set; this is not permission to admit grayscale images generally.

## Usefulness and remaining gaps

Complete references rise from 202 to 255, not by the full photo-count increase. The fixed nearby benchmark at build 3 / shoulderHip 0 / waist 1 rises from 38 to 51. Matching tolerances and the requirement for all three known axes are unchanged. The user's exact slider values remain unconfirmed; this is not their personalized result count.

`five-thousand-body-grid.json` compares 45 representative discrete selections (five build values × three shoulder/hip values × three waist values) against baseline `c2af1cf`. Twelve selections improve; 33 do not. Empty selections decline only from 13 to 12. Hips-broader/straight-waist and shoulders-broader/pronounced-waist remain empty across all five sampled builds; build 1 also lacks hips-broader/moderate-or-pronounced-waist matches. This is not exhaustive coverage of the continuous sliders. The 5,000-photo milestone does not resolve the user's coverage complaint for every selection.

| Visible styling | Photos | Complete references |
| --- | ---: | ---: |
| Masculine | 830 | 34 |
| Feminine | 2,863 | 135 |
| Mixed/androgynous | 127 | 2 |
| Unclear | 1,239 | 84 |

Masculine complete references gain 10; feminine gain 27; unclear gain 16. The archive strongly favors smaller-build feminine/runway outfits, so its large intake is not balanced body coverage. Targeted contour sourcing yielded 28 complete references from 459 candidates, versus 20 from 1,632 archive candidates. Prioritize fuller-build masculine full-outfit views, a wider set of publishers, and underrepresented shoulder/waist combinations next. Preserve all other coverage; exact presentation parity is not required. Photographs/source pages are not unique people.

## Provenance and continuation

Fashionpedia collection uses the official validation/test ZIP and two official annotation snapshots. It records individual Flickr source URLs, original image URLs, dataset IDs, source license metadata, ZIP-member SHA-256, optimized-image SHA-256, full archive hash and snapshot hashes. The collector logs 3,202 candidate decisions: 2,463 selected, 220 previously sampled, 518 without resolvable individual Flickr sources and one missing archive member. Selection means downloaded for inspection, not admission. The `retrievedAt` value is the intake run's processing timestamp; original photos are historical, not newly photographed.

Of the 2,463 downloads, 1,632 are reviewed and 831 remain explicitly unreviewed in the committed `pending-intake.json`. The full external intake digest is `7fc8612c96df667fdbbc3cdf97a2495e99e3caa99b37413aa779bf4e7b8801fd`. Pending records are included in the sourcing ledger as sampled pages with zero reviews/admissions; they cannot enter the catalog. Resume from original archive ordinal 1,632 if reviewing this backlog. Do not regenerate labels, redownload known candidates or treat pending photos as rejects. Move newly reviewed records into a later fully reviewed batch and remove their pending copies only after successful validation, retaining original ordinal provenance.

The ledger records 6,103 sampled pages and 1,953 eligible-deferred URLs across 35 source keys and 34 historical runs. This includes sampled-but-unreviewed archive records; counts are not all approved photos. Source failures and skipped decisions remain recorded. Image files, archives and contact sheets stay outside Git. The importer preserves archive restore metadata so fresh checkouts can restore exact reviewed images; changed source bytes fail closed.

## Validation

All 3,139 prior catalog/presentation records retain their order and values; prior admitted asset and body records are exact prefixes. All 5,059 image files pass manifest/digest validation, presentation reviews cover every admission, and the original 42-image visual identity baseline passes. The remaining original 343 source-linked records/assets are preserved by unchanged baseline manifests and the all-image audit. Typechecking and 131 unit tests pass. Four archive-specific Python regressions cover selection history/pending exclusions, sampled-but-unreviewed inventory, exact restoration, changed-member rejection and importer metadata retention. Nine actual archive members independently reproduce their exact reviewed WebP hashes.

The first regression run exposed stale count assertions and catalog-exhaustion test setup costs. Browser exhaustion fixtures now seed valid prior votes and execute the final real vote instead of replaying thousands of votes for each UI assertion. The full-catalog unit test still walks every photo, preserves every assertion and has a five-minute test budget. The browser all-image audit checks every image in bounded 64-image groups rather than loading the entire archive simultaneously. No production matching, storage or sequencing behavior changed.

Browser validation: 85 checks passed in the full rerun; the sole failure was the individually inspected low-chroma Foxblood photo. After adding its exact-ID exception, the all-5,059-image browser check passed in a targeted rerun (1.6 minutes), completing all 86 checks. This includes responsive/accessibility, saved-state conflicts, undo after exhaustion, strict body filters, bounded preloading, swipe gestures and the original illustrated study. Final typechecking and whitespace checks pass. No live verification is claimed for this undeployed release.
