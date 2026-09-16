# Stylr photo and label pipeline

2026-09-16. The deployment dataset and research code are maintained with the app. See `research/README.md` for portable paths, environment separation and reproduction. Original image corpora remain outside Git.

## From sources to the application

1. Download bounded selections of original outfit photographs from retailer product galleries and street-style sources. Keep source-page URLs, image URLs, local paths and SHA-256 digests. The expanded intake contains 1,676 exact-unique images across 21 sources; repeated views and recolors can still depict the same outfit.
2. Inspect numbered contact sheets for framing: full outfit, partial, seated, back, detail or reject. The body-review queue contains 411 full-standing candidates plus 782 other candidates. All 1,193 are reviewed. The other 483 intake images are outside this body-review queue.
3. The assistant directly observes apparent build (1–3), shoulder/hip balance (-1–1) and waist indentation (0–2). Unknowns are independent. Ordinary clothing can support approximate build; corsets, flared skirts, coats, cropping and pose can conceal individual axes. These are subjective visual observations, not measurements, clothing sizes or human-verified ground truth. No labels transfer between pictures based on faces or product pages.
4. Save authored observations in TSVs and bind their ordinals to immutable manifests. Produce JSON labels, record rereads and corrections, and verify completeness, unique IDs and exact image digests. Across the candidate set, 957 have build labels and 140 have all three axes. Style/silhouette/palette labels are available for the earlier full-standing pass; later batches contain clothing descriptions, not equally detailed style annotations.
5. `scripts/import-reviewed-catalog.py` admits reviewed full, partial and seated outfit views. It excludes 60 non-outfit views and 58 existing-source-page overlaps. It preserves all original 385 app records and assets, adds 1,075 photos across 698 source pages, and emits `scripts/reviewed-photos.json`, `scripts/reviewed-assets.json` and `data/catalog-review/admitted-body.json`. The 132 complete new references plus 42 existing complete references give 174. Partial observations are retained but cannot pass a required unknown axis.
6. The app imports the generated catalog and reviewed body values. Nearby matching retains its fixed limits: ±0.5 build and ±0.75 for each other axis, with all three required. Nothing widens an empty selection. Source-page grouping limits repeated gallery evidence; it does not identify people. All existing v2 reactions, notes, favorites and the illustrated app remain compatible.

Images are copied byte-for-byte, not regenerated. Photo assets and contact sheets remain outside Git. Generated asset records retain original download URLs and image digests. `licenseUrl` for new records links to the source page for inspection and makes no independent permission claim. Clothing range, frame, footwear and bottom annotations remain unknown where not explicitly reviewed. Empty feature arrays are intentional. The coarse `family` field is explicitly `unknown` for additions; reviewed style information lives in dimensions. Retailer/product text does not become body or comfort labels.

## Where clustering fits

The earlier `Documents/stylr-shape-clustering` experiment tried pose landmarks and silhouette ratios. Clothing and pose made those unreliable for body ordering. Its second iteration used MediaPipe segmentation, head-blanked grayscale crops and CLIP image embeddings, then calibrated an apparent-build ranking against 96 directly reviewed calibration images. A separate 48-image confirmation set tested the ranking. It ordered 99/125 clearly separated pairs correctly (79.2%), but did not establish reliable absolute sizing or person-independent generalization.

Those model outputs were an exploratory ranking/suggestions layer, not the production labels. The app uses 144 direct reviews from that experiment, then the directly reviewed expansion. No CLIP inference, clustering or generative body model runs in the production app. The app's later personalization uses explicit reactions and clothing metadata with breadth and source-group controls; it does not retrain that research model.

## Reproduce this admission

Run from the repository root:

```sh
python scripts/import-reviewed-catalog.py --image-root /home/workspace/Documents/stylr-catalog-pilot
python scripts/import-reviewed-catalog.py --check
bun scripts/audit-library.ts
bun run typecheck
bun run test
bun run test:browser
```

The image-root command validates every reviewed original before copying admitted images. The offline check reconstructs admission from committed provenance and checks every admitted asset. On a new machine, the original image corpus must be restored first; this importer does not fetch or silently rebind changed remote bytes. Historical intake and review scripts still live under `Documents/stylr-catalog-pilot`; their standalone old coverage projection is not the current release count.

## Repository direction

Keep this in `erhuve/stylr`: `data/` for versioned provenance and reviewed annotations, `scripts/` for deterministic admission/audits, and a future `research/` folder for the pose/CLIP experiments with isolated Python dependencies. Keep app code at its existing location for now. A full `apps/web` plus `packages/...` monorepo layout adds churn without another consuming app. A separate data repository would complicate atomic app/schema/dataset changes at this stage.

The research migration now includes scripts, environment specifications and evaluation artifacts under `research/`. Catalog scripts use `STYLR_INTAKE_ROOT`; body-shape scripts resolve assets from the repository. Images, model weights, virtual environments and private sessions stay outside Git. Historical source corpora remain in the workspace; the migration does not rerun training or promote predictions.
