# Targeted continuation batches

Afternoon continuation: `2026-09-16T1905-coverage` reviews 160 candidates and admits 76 photos (three complete references); `2026-09-16T1910-dark` reviews 115 and admits 53 (one complete); `2026-09-16T1915-color` reviews 105 and admits 36 (none complete). All 33 contact sheets were directly inspected, followed by 12 original-image enlargements. Their per-batch `review.md` files record corrections, exclusions and source lessons. Together they add 143 source pages, 148 build observations and four complete references. These additions remain undeployed. External corpus folders are `expansion-2026-09-16-evening-a`, `-b` and `-c` under the existing intake root.

Further continuation: `2026-09-16T1820-diversity` reviews 142 candidates and admits 87 photos (seven complete references); `2026-09-16T1825-street` reviews 118 and admits 52 (five complete). All 22 contact sheets were directly inspected, followed by 20 enlarged rereads. Three initially proposed complete observations in the diversity batch lost unsupported axes on reread. Together they add 112 source pages, 124 build observations and 12 complete references. Back/detail/group/size-chart/repetitive images remain excluded. Corpus folders are `expansion-2026-09-16-diversity` and `expansion-2026-09-16-street` under the external intake root. Per-product search decisions and download outcomes accompany the immutable manifests. Read `data/sourcing/README.md` before the next collection.

2026-09-16: 118 candidates across five retailer sources, followed by 60 further Snag candidates. All 178 images were directly inspected on 15 numbered contact sheets. Twenty-one selected images were enlarged and reread; jackets, corset construction, loose hips, angled poses and gathered dresses kept uncertain traits unknown. No prediction or source text supplied a body label.

`observations.tsv` is authored. `intake.json` binds ordinals to unique IDs, source/image URLs and SHA-256 hashes. `sources.json` records actual retrieval scope. `labels.json` is compiled with `research/catalog/compile_targeted.py`. Original images and sheets remain in the external corpus's `expansion-2026-09-16` and `expansion-2026-09-16-snag` directories.

108 admitted photographs span 79 new source pages. The remaining 70 are backs, details, promotional collages, or manually excluded repetitive variants. Nine additions have complete three-axis observations; 93 have apparent build. Four complete references add matches at build 3 / shoulder balance 0 / waist 1. Photographs and product pages are not verified distinct people. Repeated source-page photos share the app's evidence grouping.

For a batch, set `STYLR_INTAKE_ROOT` to the external corpus and run `research/catalog/expand_targeted.py --help`. Collect into a new directory; never overwrite a reviewed snapshot. Copy its intake/source manifests into a new batch directory, author all observations after directly viewing images, then run:

```sh
python research/catalog/compile_targeted.py --batch data/catalog-review/batches/BATCH --image-root "$STYLR_INTAKE_ROOT"
python scripts/import-reviewed-catalog.py --image-root "$STYLR_INTAKE_ROOT"
python scripts/import-reviewed-catalog.py --check
```

Raw product responses are saved outside Git. A source being selected for coverage is not a claim that each picture supports that coverage. Unknowns never qualify for required axes.
