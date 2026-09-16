# Sourcing coverage

Generated from committed manifests by `research/catalog/source_inventory.py`.

Counts are photographs and source pages, not distinct people. Review/admission yields cover the expansion only; the 385 baseline photos have separate historical annotation formats. Deferred pages were text-eligible in the recorded snapshot, not visually reviewed or guaranteed still available. A short response is not proof a retailer is exhausted.

| Source | Sampled pages | Candidate images | Reviewed expansion | Admitted expansion | Complete expansion | Deferred pages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| acdcrag | 63 | 116 | 73 | 45 | 1 | 143 |
| bigbudpress | 129 | 221 | 192 | 130 | 22 | 121 |
| chubstr | 15 | 35 | 27 | 27 | 4 | 0 |
| disturbia | 24 | 48 | 48 | 37 | 3 | 0 |
| flickr.com | 93 | 237 | 0 | 0 | 0 | 0 |
| forestink | 80 | 157 | 130 | 72 | 5 | 19 |
| foxblood | 78 | 156 | 142 | 115 | 16 | 77 |
| kirrinfinch | 61 | 132 | 91 | 75 | 3 | 0 |
| lucyandyak | 24 | 48 | 39 | 34 | 8 | 0 |
| midnighthour | 76 | 173 | 151 | 116 | 13 | 135 |
| mochipan | 72 | 168 | 140 | 113 | 2 | 65 |
| morningwitch | 51 | 86 | 35 | 13 | 0 | 123 |
| myviolet | 75 | 168 | 138 | 113 | 2 | 55 |
| onebone | 35 | 86 | 86 | 27 | 0 | 149 |
| pettilia | 8 | 16 | 5 | 5 | 0 | 0 |
| pexels.com | 40 | 40 | 0 | 0 | 0 | 0 |
| punkrave | 48 | 96 | 50 | 35 | 6 | 163 |
| shinybynature | 78 | 156 | 148 | 100 | 27 | 9 |
| snag | 150 | 298 | 275 | 212 | 17 | 68 |
| tokyofashion | 864 | 974 | 846 | 665 | 9 | 13 |
| tombolo | 35 | 69 | 69 | 14 | 0 | 38 |
| trippnyc | 48 | 96 | 52 | 31 | 8 | 165 |
| universalstandard | 58 | 58 | 58 | 52 | 1 | 0 |
| universalworks | 20 | 57 | 57 | 17 | 0 | 205 |
| unsplash.com | 2 | 2 | 0 | 0 | 0 | 0 |
| wear | 611 | 611 | 611 | 592 | 0 | 0 |
| wildfang | 111 | 221 | 194 | 114 | 13 | 76 |

## Presentation coverage

The image-bound presentation audit is refreshed with this inventory. Read `../presentation/coverage.md` for admitted photos, source breadth and complete body references by visible styling and build. Extensive masculine and feminine coverage matters; exact parity is not required. Prioritize the current masculine full-outfit gap. Missing reviews remain explicit; run `bun scripts/audit-presentation.ts --check --require-complete` before completing a batch.

## Next sourcing pass

Start with `next-pages.json`: exact source URLs, listing URLs and the manifest that observed them. Prioritize sources with useful complete-reference yield and gaps in style coverage. Use the collector again to refresh listings and skip every committed sampled page, including rejected views. Failed downloads are retry candidates recorded in sources.json; they are not successful samples.

Historical runs retain their original scope. Older runs did not record every skipped product; their absent decisions remain unknown. `pages.json` backfills only provably sampled pages, with links to the manifests containing each image ID. Raw provider responses remain in the external corpus; new run pages include snapshot hashes.
