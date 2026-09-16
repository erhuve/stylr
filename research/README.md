# Stylr research

Migrated 2026-09-16. These offline experiments share a repository with the app so code, annotations and admission contracts can be reviewed together. They are not production inference. The app only consumes directly reviewed observations under `data/`.

## Catalog sourcing and review

`data/sourcing/README.md` is the continuation workflow. `catalog/source_inventory.py` compiles sampled-page provenance, per-source yields, historical retrieval logs and the exact deferred-page queue. New collections record every listing decision, image outcome and raw snapshot hash. The collector checks committed batch history as well as the external corpus, so a fresh checkout cannot accidentally reuse earlier sampled pages.

New targeted batches use `catalog/expand_targeted.py` for bounded source discovery, downloads and sheets, then `catalog/compile_targeted.py` for authored observation validation. See `data/catalog-review/batches/README.md`. All live admission still goes through `scripts/import-reviewed-catalog.py`.

`catalog/` contains the original bounded retailer and street-style intake, contact-sheet generation and authored-review validation scripts. Set `STYLR_INTAKE_ROOT` to an external corpus directory before running them. On the current Zo this is `/home/workspace/Documents/stylr-catalog-pilot`.

Install Pillow, requests and beautifulsoup4 in an isolated Python environment. Each script has `--help`. Historical commands expect the original corpus layout: `raw/`, `images/`, `baseline/`, `expansion-2026-09-15/`, and `body-style-review/`. Do not run collect or prepare against a reviewed snapshot. Keep authored ordinal mappings and digests unchanged. Historical `pilot.py audit` uses the initial 144 reviews and is not a current production coverage report.

The completed 1,193-candidate review and admission inputs are committed under `data/catalog-review/`. `scripts/import-reviewed-catalog.py --check` validates production admission without a network request. Original raw provider responses and image corpora remain external; the production importer never silently substitutes newly downloaded bytes for reviewed images.

## Body-shape experiments

`body-shape/` preserves pose features, clustering, calibration and the second iteration's CLIP ranking, authored calibration/confirmation observations and evaluation outputs. Paths resolve to this repository's original `public/photos/` assets. `requirements.txt` records the pose environment; `v2/embedding-environment.json` records the separate embedding environment and `v2/embedding-model.json` pins the encoder revision. These environments remain separate because their NumPy versions differ.

To reproduce extraction, restore the original assets with `scripts/fetch-photos.py`, install the pose requirements in an isolated environment, and obtain MediaPipe's `pose_landmarker_full.task` in `research/body-shape/`. Then run `experiment.py --help`, `calibrate.py`, `v2/refine.py all`, and `v2/prepare_crops.py`. In the embedding environment run `v2/embed.py`; back in the pose environment run `v2/evaluate_embeddings.py` and `v2/evaluate_holdout.py`. `v2/build_browser.py` renders the saved observations and clearly separate model suggestions using `browser-template.html`.

Do not regenerate calibration or holdout IDs and reuse old ordinal observations. Model weights, environments, photo crops, embeddings and generated photo browsers are ignored. Saved results are historical evidence, not a claim that training was rerun during migration.

The confirmation set achieved 99/125 clear-pair orderings (79.2%). Pairs share images; labels are subjective apparent-build judgments, not measurements. Person-independent generalization and accurate absolute sizing are unestablished. Predictions never become production labels.
