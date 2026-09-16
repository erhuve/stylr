# Sourcing coverage

Generated from committed manifests by `research/catalog/source_inventory.py`.

Counts are photographs and source pages, not distinct people. Review/admission yields cover the expansion only; the 385 baseline photos have separate historical annotation formats. Deferred pages were text-eligible in the recorded snapshot, not visually reviewed or guaranteed still available. A short response is not proof a retailer is exhausted.

| Source | Sampled pages | Candidate images | Reviewed expansion | Admitted expansion | Complete expansion | Deferred pages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| acdcrag | 48 | 94 | 51 | 39 | 1 | 158 |
| bigbudpress | 94 | 152 | 123 | 103 | 19 | 156 |
| chubstr | 15 | 35 | 27 | 27 | 4 | 0 |
| disturbia | 24 | 48 | 48 | 37 | 3 | 0 |
| flickr.com | 93 | 237 | 0 | 0 | 0 | 0 |
| forestink | 60 | 119 | 92 | 61 | 5 | 39 |
| foxblood | 58 | 116 | 102 | 90 | 16 | 97 |
| kirrinfinch | 61 | 132 | 91 | 75 | 3 | 0 |
| lucyandyak | 24 | 48 | 39 | 34 | 8 | 0 |
| midnighthour | 56 | 136 | 114 | 99 | 12 | 0 |
| mochipan | 57 | 138 | 110 | 99 | 2 | 80 |
| morningwitch | 36 | 63 | 12 | 12 | 0 | 0 |
| myviolet | 60 | 138 | 108 | 98 | 2 | 70 |
| pettilia | 8 | 16 | 5 | 5 | 0 | 0 |
| pexels.com | 40 | 40 | 0 | 0 | 0 | 0 |
| punkrave | 48 | 96 | 50 | 35 | 6 | 163 |
| shinybynature | 58 | 116 | 108 | 87 | 26 | 29 |
| snag | 100 | 199 | 176 | 142 | 17 | 19 |
| tokyofashion | 158 | 268 | 140 | 81 | 7 | 0 |
| trippnyc | 48 | 96 | 52 | 31 | 8 | 165 |
| universalstandard | 58 | 58 | 58 | 52 | 1 | 0 |
| unsplash.com | 2 | 2 | 0 | 0 | 0 | 0 |
| wear | 60 | 60 | 60 | 60 | 0 | 0 |
| wildfang | 46 | 92 | 65 | 55 | 13 | 141 |

## Next sourcing pass

Start with `next-pages.json`: exact source URLs, listing URLs and the manifest that observed them. Prioritize sources with useful complete-reference yield and gaps in style coverage. Use the collector again to refresh listings and skip every committed sampled page, including rejected views. Failed downloads are retry candidates recorded in sources.json; they are not successful samples.

Historical runs retain their original scope. Older runs did not record every skipped product; their absent decisions remain unknown. `pages.json` backfills only provably sampled pages, with links to the manifests containing each image ID. Raw provider responses remain in the external corpus; new run pages include snapshot hashes.
