# Stylr research

Migrated 2026-09-16. These offline experiments share a repository with the app so code, annotations and admission contracts can be reviewed together. They are not production inference. The app only consumes directly reviewed observations under `data/`.

## Catalog sourcing and review

Latest source review: `2026-09-17T2310-poncho` directly inspects 24 candidates and excludes all products/details/rear views. Counts stay 7,177 photos and 291 complete references. Append after this batch; consult the active doubling handoff for validation and source priorities. The earlier paragraphs retain historical checkpoints.

Latest batch is `2026-09-17T2240-targeted`: 32 Wool&Prince/Snag candidates directly reviewed, 12 admitted and one complete fuller-build reference added. Repository totals are 7,168 photos and 291 complete references. The 3,744 training candidates remain pending from original ordinal 1056. Append after `2240-targeted`; see the active doubling handoff for source decisions and validation. Earlier batch lists below describe historical training partitions.

`catalog/collect_fashionpedia_batch.py` prepares photos from downloaded official Fashionpedia metadata and ZIP members in `OUTPUT/raw`. It retains individual Flickr URLs, dataset IDs, license metadata, snapshot/member/image hashes and every selection/exclusion decision; it never turns dataset attributes into body labels. Existing and pending image IDs, Flickr IDs and exact image hashes are excluded. Use `STYLR_INTAKE_ROOT=... python research/catalog/collect_fashionpedia_batch.py --output ... --limit 2800`. The default uses `val_test2020.zip`, `info_test2020.json` and `instances_attributes_val2020.json`; `--split training` uses `train2020.zip` and `attributes_train2020.json`. The old 831 pending validation/test photos were fully reviewed in `2026-09-17T0520-archive`; the old pending array is now empty. Training batches `0540-training`, `1600-training`, `1840-training`, `1920-training`, `2000-training`, `2100-training` and `2200-training` review original collection ordinals 0–1055; the first batch's pending array preserves 3,744 unreviewed candidates starting at ordinal 1056. See the active `docs/verification/doubling-sourcing.md` before continuing. Pending intake remains excluded until direct inspection and authored observations; no dataset attribute or source department supplies a label.

`data/sourcing/README.md` is the continuation workflow. `catalog/source_inventory.py` compiles sampled-page provenance, per-source yields, historical retrieval logs and the exact deferred-page queue. New collections record every listing decision, image outcome and raw snapshot hash. The collector checks committed batch history as well as the external corpus, so a fresh checkout cannot accidentally reuse earlier sampled pages.

New targeted batches use `catalog/expand_targeted.py` for bounded source discovery, downloads and sheets, then `catalog/compile_targeted.py` for authored observation validation. See `data/catalog-review/batches/README.md`. All live admission still goes through `scripts/import-reviewed-catalog.py`.

`catalog/collect_street_batch.py` adds bounded WEAR listing and Tokyo Fashion archive collection with explicit page numbers, one image per post, exact-byte deduplication, source snapshots and all listing/download decisions. WEAR uses full-resolution detail images and a default three-post account cap across prior sampled pages; an account is not a verified person. Regional-unavailability pages are recorded as failures, never successful empty listings. Use a fresh output directory and pass `--source`, `--pages` and `--limit`; source departments never supply presentation labels. See `docs/verification/three-thousand-sourcing.md` for the first run and its limitations.

`catalog/` contains the original bounded retailer and street-style intake, contact-sheet generation and authored-review validation scripts. Set `STYLR_INTAKE_ROOT` to an external corpus directory before running them. On the current Zo this is `/home/workspace/Documents/stylr-catalog-pilot`.

Install Pillow, requests and beautifulsoup4 in an isolated Python environment. Each script has `--help`. Historical commands expect the original corpus layout: `raw/`, `images/`, `baseline/`, `expansion-2026-09-15/`, and `body-style-review/`. Do not run collect or prepare against a reviewed snapshot. Keep authored ordinal mappings and digests unchanged. Historical `pilot.py audit` uses the initial 144 reviews and is not a current production coverage report.

The completed 1,193-candidate review and admission inputs are committed under `data/catalog-review/`. `scripts/import-reviewed-catalog.py --check` validates production admission without a network request. Original raw provider responses and image corpora remain external; the production importer never silently substitutes newly downloaded bytes for reviewed images.

## Body-shape experiments

`body-shape/` preserves pose features, clustering, calibration and the second iteration's CLIP ranking, authored calibration/confirmation observations and evaluation outputs. Paths resolve to this repository's original `public/photos/` assets. `requirements.txt` records the pose environment; `v2/embedding-environment.json` records the separate embedding environment and `v2/embedding-model.json` pins the encoder revision. These environments remain separate because their NumPy versions differ.

To reproduce extraction, restore the original assets with `scripts/fetch-photos.py`, install the pose requirements in an isolated environment, and obtain MediaPipe's `pose_landmarker_full.task` in `research/body-shape/`. Then run `experiment.py --help`, `calibrate.py`, `v2/refine.py all`, and `v2/prepare_crops.py`. In the embedding environment run `v2/embed.py`; back in the pose environment run `v2/evaluate_embeddings.py` and `v2/evaluate_holdout.py`. `v2/build_browser.py` renders the saved observations and clearly separate model suggestions using `browser-template.html`.

Do not regenerate calibration or holdout IDs and reuse old ordinal observations. Model weights, environments, photo crops, embeddings and generated photo browsers are ignored. Saved results are historical evidence, not a claim that training was rerun during migration.

The confirmation set achieved 99/125 clear-pair orderings (79.2%). Pairs share images; labels are subjective apparent-build judgments, not measurements. Person-independent generalization and accurate absolute sizing are unestablished. Predictions never become production labels.
