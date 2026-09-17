# Targeted continuation batches

Latest batch `2026-09-17T0030-postdeploy`: 117 directly reviewed candidates, 53 admissions, 50 build observations and no complete references. Ten bound sheets and five enlarged rereads support 22 masculine, 19 feminine and 12 unclear additions. All prior records remain unchanged; see `docs/verification/postdeploy-sourcing.md` for validation and deployment status. Next batch names must sort after this one. Earlier entries below are historical.

Latest continuation: twelve batches from `2026-09-16T2200-wear-men` through `2026-09-17T0020-tokyo-more` directly review 1,257 candidates on 58 bound sheets, admitting 1,116 photographs, 378 build observations and two complete references. Each includes authored observations, compiled labels, image-bound presentation evidence and source decisions. Repository total: 3,086 photos, 202 complete references and 38 example matches; not deployed. See `docs/verification/three-thousand-sourcing.md`. The following paragraphs preserve previous batch history.

Latest interactive batch `2026-09-16T2045-menswear`: 153 directly reviewed candidates, 40 admissions across 39 pages, 34 build observations, no complete references; 26 masculine-styled and 14 neutral outfits. Three new sources and all listing/alternate-gallery decisions are retained. Read its review.md for repeated-view exclusions and full-view selection lessons. Repository total: 1,970 photos, 200 complete references and 38 example matches; not deployed.

September 16, 4 p.m. run: `2026-09-16T2005-tailoring` reviews 60 candidates and admits 26; `2026-09-16T2010-fitted` reviews 59 and admits 32. Ten bound sheets, nine enlargements and nine prior-image comparison pairs support 58 admissions across 51 new pages, 55 build observations and one complete reference. Presentation additions are 16 masculine, 20 feminine, one mixed and 21 unclear. Their manifests and review notes preserve all search decisions, exclusions and raw hashes; originals live in the correspondingly named `expansion-` directories under the external intake root. Repository totals are 1,930 photos and 200 complete references; deployment remains pending. Earlier paragraphs below retain historical batch results.

Every new admitted photo also needs a hash-bound visible-presentation review under `data/presentation/`; read that rubric and the current coverage report before sourcing. Extensive masculine and feminine coverage is required, not exact parity. Run `bun scripts/audit-presentation.ts --check --require-complete` after refreshing the sourcing inventory and before marking a batch complete. Report actual additions and complete body references by presentation, source diversity and repeats; never infer model identity from styling.

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
# September 17 continuation

The four batches ending `0040-afternoon-final`, `0300-contours`, `0310-breadth` and `0320-fashionpedia` review 2,992 candidates and admit 1,920 photos, reaching 5,059 repository photos. See `docs/verification/five-thousand-sourcing.md` for results and release status.

The Fashionpedia batch's `intake.json` contains only the reviewed 1,632-image prefix. Its `pending-intake.json` retains the remaining 831 downloaded candidates, still unreviewed and excluded from admission. `sources.json` and `searches.json` cover the full collection; selected means downloaded for review, not admitted. Never compile pending rows as rejects to satisfy completeness. A continuation must move reviewed candidates into a new, fully reviewed batch without duplicating their sampled records or rebinding hashes. Ordinals in `observations.tsv` refer to the reviewed intake; archived contact sheets retain original collection ordinals. `contour-recheck.tsv` records the 42 enlarged-image checks.
