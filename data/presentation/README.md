# Outfit presentation audit

September 16, 2026: all 1,872 repository photos directly inspected on 24 numbered contact sheets. All 290 initial masculine/mixed assignments received a second pass at larger tile size; 29 were corrected in `rereview.json`. `review.json` binds every final observation to the catalog ID and SHA-256 of the displayed WebP. Ordinals and sheet numbers describe the frozen `5b772cc` catalog order, not future array positions. The initial review is by Codex, not a human annotation team or a trained classifier.

## Rubric v1

These labels describe visible outfit presentation, not a person's sex, gender identity or anatomical category. Masculine clothing may be worn by anyone. The requested breadth of male/female-presenting models is tracked through visible styling only; this audit cannot establish counts of male/female people. Faces, names, body shape, retailer departments and brand associations are not classification evidence. Styling conventions are contextual and subjective; counts are a first-pass coverage screen, not objective ground truth.

Authored evidence codes (expanded by `scripts/audit-presentation.ts`):

| Code | Category | Visible evidence |
| --- | --- | --- |
| D | feminine | Dress/skirt-led feminine ensemble |
| F | feminine | Feminine separates: romantic, lace, corset, ruffled, fitted/cropped or heeled styling, assessed together |
| M | masculine | Masculine tailoring ensemble, including suit/waistcoat, collared shirt/tie and trouser styling |
| C | masculine | Masculine casual/workwear ensemble, including polo, collared/utility layers and trouser/short styling |
| X | mixed-androgynous | Visible combination of conventionally masculine and feminine cues |
| U | unclear | Neutral basics, ambiguous ensemble, insufficient crop or obscured cues |

A garment alone is not a universal gender rule. A tee, trousers, bright colors, short hair or a large body does not establish masculinity. A cropped top alone does not establish femininity. Mixed is positive visible evidence of combined styling, not a substitute for uncertainty. Neutral/basic outfits remain unclear. Crops describe only what is visible; unseen clothing is not inferred. Evidence codes are coarse ensemble-level notes, not a complete garment inventory.

## Continue and verify

The 4 p.m. scheduled run appends 58 directly reviewed admissions, reaching 1,930/1,930 reviewed images. New rows retain batch name and external sheet path alongside the within-batch ordinal; the top-level catalogRevision and the original ordinals continue to describe the initial frozen audit. All prior rows are unchanged. Current counts and body-reference coverage are generated in coverage.md.

1. Inspect each newly admitted image directly using the same rubric. Add its ID, actual displayed-file digest, evidence code, review date and stable review-sheet reference to `review.json`. Preserve previous records and record deliberate corrections separately. Never copy a label between photos based on shared faces or pages.
2. Run `bun scripts/audit-presentation.ts` after admission. Missing reviews appear explicitly as unreviewed, separate from reviewed unclear. Unknown IDs, duplicates, bad evidence codes and changed image bytes fail validation.
3. Before committing a completed sourcing batch, run `bun scripts/audit-presentation.ts --check --require-complete`. This also fails on stale reports or missing reviews. `research/catalog/source_inventory.py` refreshes presentation coverage automatically as part of rebuilding the sourcing ledger.
4. Consult `coverage.md` and `coverage.json` before the next searches. They report all categories, source pages/hosts, existing build scores and complete three-axis references. Body labels and app matching are unchanged; there is no presentation filter in the app.

The latest user clarification supersedes the earlier roughly-equal-share target: extensive coverage of both masculine and feminine presentations matters; an imbalance is acceptable. Prioritize the underrepresented masculine pool now, particularly full-outfit, complete body-reference coverage across builds and multiple sources. Retain feminine, mixed and unclear examples. Do not manufacture equality by deleting photos, forcing ambiguous labels, repeating poses or inflating counts through colorways.

These are photo counts, not unique model counts. A source page may contain several photos; a model can recur across unrelated pages and sources. No face recognition or model identity clustering is used. Source-page/host breadth reduces one form of concentration but does not prove distinct-person diversity. Report repetition and framing issues in future sourcing notes.

Contact sheets are local ignored artifacts in `.cache/presentation/`. Reproduce them from the fixed review ordinals and hash-verified photo files; no contact sheets or private images are committed. This audit concerns the 1,872-photo repository snapshot; production remains separately deployed.
