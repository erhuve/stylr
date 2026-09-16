# Cropped, seated and unreviewed candidates — continuation 02

2026-09-16. Completed: 120 additional candidates across 20 sources, directly inspected by the primary assistant on all ten numbered twelve-image sheets (`sheets/01.jpg` through `sheets/10.jpg`). Total candidate review is now 651 photographs; 542 remain. Staged local observations only.

86 support apparent build, 8 shoulder/hip balance, 8 waist indentation, and 6 all three axes. 34 have unknown build. Build bands: 49 slender–intermediate, 13 intermediate, 9 intermediate–fuller and 15 fuller/broader. These are approximate visual impressions under the parent README rubric, not measurements or independently validated labels.

Framing: 90 partial, 12 full standing, 8 seated, 6 detail-only and 4 rejected. Rejections include three product-only images and one question-mark placeholder graphic. Unknown axes remain null; no body labels are assigned to detail-only or rejected images. No identity linkage, inferred clothing size or label transfer between related product images is used.

## Method and validation

Input is the preserved 662-entry queue in `../continuation-01/remaining-review-queue.json`. Selection cycles through alphabetically sorted sources, taking each next queued candidate until 120 are selected, then sorts by source and ID for inspection. It is a source-breadth batch, not a random or coverage-optimized sample. Source pages can repeat people and outfits.

The apparent-build anchors remain 1/1.5/2/2.5/3; shoulder/hip -1/0/1; waist 0/1/2. Ordinary clothing can support an approximate build impression; local axes require visible comparative contours. Clothing notes describe garments separately from body labels.

Twelve records received enlarged rereads on `sheets/reread-1.jpg` and `sheets/reread-2.jpg`, including every initially complete record and selected partial/unknown local axes. Waist labels were removed from 72 (oblique pose, hand and gathered skirt) and 73 (rigid vest panels). The corrections are preserved in `reread.json`. This is a same-reviewer check, not independent agreement. No individual source image was opened outside these sheets.

`observations.tsv` is authored evidence; `manifest.json` fixes ordinal-to-ID, source metadata and SHA-256 bindings. The audit verifies all 120 current image digests, exact catalog records, allowed values, ordinal coverage, uniqueness, disjointness from both earlier passes, correction outcomes and the remaining queue partition. `labels.json`, `summary.json` and `remaining-review-queue.json` are generated.

Recompute with `python /home/workspace/Documents/stylr-catalog-pilot/review_remaining.py audit 2`. `prepare 2` recreates primary sheets while refusing changed mappings. Omitting the batch number preserves continuation 01 behavior. No network, classifier or application build is required.

## Resume here

Use this folder's **542-entry `remaining-review-queue.json`** for continuation 03. Run `python /home/workspace/Documents/stylr-catalog-pilot/review_remaining.py prepare 3` to prepare the next bounded batch. Do not overwrite earlier mappings or observations.

The six complete records are not six verified distinct outfits or new live matches. Source-page overlap and framing suitability still require evaluation before admission. The earlier matching projection, canonical labels, source browser and live feed remain unchanged.
