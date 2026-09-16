# Cropped, seated and unreviewed candidates — continuation 03

2026-09-16. Completed: 120 additional candidates across 18 sources, directly inspected by the primary assistant on all ten numbered twelve-image sheets (`sheets/01.jpg` through `sheets/10.jpg`). Total candidate review is now 771 photographs; 422 remain. Staged local observations only.

87 support apparent build, 5 shoulder/hip balance, 6 waist indentation, and 2 all three axes. 33 have unknown build. Build bands: 49 slender–intermediate, 5 intermediate, 12 intermediate–fuller and 21 fuller/broader. These are approximate visual impressions under the parent README rubric, not measurements or independently validated labels.

Framing: 93 partial, 13 full standing, 6 seated, 4 detail-only and 4 rejected. Rejections are product-only photographs of bags, fabric accessories, a shirt and trousers. Unknown axes remain independently null; no body labels are assigned to detail-only or rejected images. No identity linkage, inferred clothing size or label transfer between related photographs is used.

## Method and validation

Input is the preserved 542-entry queue in `../continuation-02/remaining-review-queue.json`. Selection cycles through alphabetically sorted sources, taking each next queued candidate until 120 are selected, then sorts by source and ID for inspection. This is a source-breadth batch, not a random or coverage-optimized sample. Source pages can repeat people and outfits.

Apparent-build anchors remain 1/1.5/2/2.5/3; shoulder/hip -1/0/1; waist 0/1/2. Ordinary clothing can support an approximate build impression; local axes require visible comparative contours. Clothing descriptions are separate from body labels.

Twelve records received enlarged rereads on `sheets/reread-1.jpg` and `sheets/reread-2.jpg`, including every initially complete record, all other supported local axes and two uncertain build judgments. Build labels were removed from 19 and 116 because tailoring and framing concealed sufficient independent cues. Shoulder/hip was cleared for 89 and 106; waist was cleared for 106 and 118 because pose or draping concealed the underlying contour. All six corrections are preserved in `reread.json`. This is a same-reviewer check, not independent agreement. No individual source image was opened outside these sheets.

`observations.tsv` is authored evidence; `manifest.json` fixes ordinal-to-ID, source metadata and SHA-256 bindings. The audit passed for all 120 current image digests, exact catalog records, allowed values, ordinal coverage, uniqueness, disjointness from prior passes, correction outcomes and the remaining queue partition. `labels.json`, `summary.json` and `remaining-review-queue.json` are generated.

Recompute with `python /home/workspace/Documents/stylr-catalog-pilot/review_remaining.py audit 3`. `prepare 3` recreates primary sheets while refusing changed mappings. No network, classifier or application build is required.

## Resume here

Use this folder's **422-entry `remaining-review-queue.json`** for continuation 04. Run `python /home/workspace/Documents/stylr-catalog-pilot/review_remaining.py prepare 4` to prepare the next bounded batch. Do not overwrite earlier mappings or observations.

The two complete records are not two verified distinct outfits or new live matches. Source-page overlap and framing suitability require evaluation before admission. The earlier matching projection, canonical labels, source browser and live feed remain unchanged.
