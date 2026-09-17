# Sourcing coverage

Generated from committed manifests by `research/catalog/source_inventory.py`.

Counts are photographs and source pages, not distinct people. Review/admission yields cover the expansion only; the 385 baseline photos have separate historical annotation formats. Deferred pages were text-eligible in the recorded snapshot, not visually reviewed or guaranteed still available. A short response is not proof a retailer is exhausted.

| Source | Sampled pages | Candidate images | Reviewed expansion | Admitted expansion | Complete expansion | Deferred pages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| acdcrag | 63 | 116 | 73 | 45 | 1 | 143 |
| activetruth | 30 | 60 | 60 | 2 | 0 | 171 |
| americantall | 20 | 40 | 40 | 6 | 0 | 215 |
| ashanderie | 78 | 168 | 168 | 24 | 1 | 148 |
| bigbudpress | 177 | 317 | 288 | 154 | 23 | 73 |
| chubbies | 12 | 24 | 24 | 6 | 0 | 105 |
| chubstr | 15 | 35 | 27 | 27 | 4 | 0 |
| copperunion | 30 | 60 | 60 | 32 | 1 | 82 |
| dapperboi | 30 | 60 | 60 | 11 | 1 | 16 |
| disturbia | 24 | 48 | 48 | 37 | 3 | 0 |
| fashionpedia | 7263 | 7263 | 3447 | 3135 | 35 | 37631 |
| flickr.com | 93 | 237 | 0 | 0 | 0 | 0 |
| forestink | 99 | 195 | 168 | 80 | 5 | 0 |
| forthefit | 34 | 56 | 56 | 7 | 1 | 36 |
| foxblood | 108 | 216 | 202 | 156 | 19 | 48 |
| freshcleantees | 23 | 43 | 43 | 11 | 0 | 51 |
| girlfriend | 54 | 120 | 120 | 15 | 6 | 31 |
| kirrinfinch | 61 | 132 | 91 | 75 | 3 | 0 |
| lucyandyak | 24 | 48 | 39 | 34 | 8 | 0 |
| midnighthour | 106 | 227 | 205 | 144 | 13 | 105 |
| mochipan | 102 | 227 | 199 | 133 | 2 | 35 |
| morningwitch | 51 | 86 | 35 | 13 | 0 | 123 |
| myviolet | 105 | 227 | 197 | 144 | 2 | 25 |
| onebone | 94 | 237 | 237 | 71 | 0 | 89 |
| perryellis | 12 | 24 | 24 | 8 | 0 | 175 |
| pettilia | 8 | 16 | 5 | 5 | 0 | 0 |
| pexels.com | 40 | 40 | 0 | 0 | 0 | 0 |
| punkrave | 78 | 156 | 110 | 60 | 6 | 133 |
| shinybynature | 90 | 180 | 172 | 108 | 27 | 0 |
| snag | 210 | 416 | 393 | 294 | 18 | 8 |
| stateandliberty | 51 | 98 | 98 | 28 | 16 | 145 |
| strongsize | 34 | 66 | 66 | 13 | 0 | 35 |
| superfithero | 51 | 121 | 121 | 38 | 8 | 0 |
| taperedmenswear | 8 | 16 | 16 | 3 | 1 | 56 |
| teddyfresh | 30 | 60 | 60 | 2 | 0 | 2 |
| theperfectjean | 24 | 60 | 60 | 12 | 0 | 221 |
| tokyofashion | 1064 | 1174 | 1046 | 804 | 9 | 13 |
| tombolo | 58 | 115 | 115 | 26 | 0 | 8 |
| trippnyc | 78 | 156 | 112 | 33 | 8 | 136 |
| trueclassic | 30 | 51 | 51 | 12 | 6 | 198 |
| under510 | 12 | 24 | 24 | 7 | 0 | 108 |
| universalstandard | 88 | 117 | 117 | 80 | 7 | 131 |
| universalworks | 68 | 153 | 153 | 17 | 0 | 157 |
| unsplash.com | 2 | 2 | 0 | 0 | 0 | 0 |
| wear | 611 | 611 | 611 | 592 | 0 | 0 |
| wildfang | 179 | 366 | 339 | 179 | 13 | 8 |

## Presentation coverage

The image-bound presentation audit is refreshed with this inventory. Read `../presentation/coverage.md` for admitted photos, source breadth and complete body references by visible styling and build. Extensive masculine and feminine coverage matters; exact parity is not required. Prioritize the current masculine full-outfit gap. Missing reviews remain explicit; run `bun scripts/audit-presentation.ts --check --require-complete` before completing a batch.

## Next sourcing pass

Start with `next-pages.json`: exact source URLs, listing URLs and the manifest that observed them. Prioritize sources with useful complete-reference yield and gaps in style coverage. Use the collector again to refresh listings and skip every committed sampled page, including rejected views. Failed downloads are retry candidates recorded in sources.json; they are not successful samples.

Historical runs retain their original scope. Older runs did not record every skipped product; their absent decisions remain unknown. `pages.json` backfills only provably sampled pages, with links to the manifests containing each image ID. Raw provider responses remain in the external corpus; new run pages include snapshot hashes.
