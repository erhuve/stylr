# TokyoFashion street-style corpus

Review date: 2026-09-14. Scope: the street-style workstream of the approved personal discovery expansion. No publication or service change was made.

## Delivered

- **106 distinct full-outfit color photographs**, within the requested 80–120 range. Shortfall against the minimum of 80: **0**.
- `scripts/streetstyle-photos.json`: 106 new Photo records; original post URLs, publisher credits, visual descriptions, grouped dimensions and conservative garment visibility.
- `scripts/streetstyle-assets.json`: 106 exact original image URLs, each paired with its Photo ID.
- `public/photos/street-tokyo-*.webp`: 106 local optimized assets, ignored by Git. Last successful full image audit: **19,758,876 bytes** total, all decoded successfully as RGB WebP, max 1100×1400, no exact decoded-pixel duplicates.
- `scripts/streetstyle-import.py`: repeatable manifest download, validation, public archive discovery, numbered contact sheets, and eight embedded offline regression tests.

All new IDs start with `street-tokyo-`; all new `src` values use `/photos/<id>.webp`. Neither the original catalog, the original asset manifest, original photo files, nor v2 session code/data was modified by this workstream. The parent integrates these new arrays separately.

## Source and review procedure

The TokyoFashion homepage and street-photo archive were inspected using `read_webpage`. The public WordPress REST posts endpoint returned HTTP 403; it was not bypassed or retried with access-control evasions. The ordinary public HTML archive and directly linked public post/image URLs remained accessible. The importer cached those HTML pages and parsed their post shortlinks and linked full-resolution images.

Archive windows: `https://tokyofashion.com/photos/?location=Harajuku&start=0`, `start=40`, `start=80`, and `start=200`. They yielded 160 unique candidate posts, spanning 2020–2024. Source descriptions were screened for explicit under-18 ages before download. 145 remaining candidate images were displayed in thirteen numbered contact sheets and visually reviewed using `read_file`; 106 were admitted. Several uncertain lower garments and shoes received an additional enlarged 16-tile visual check and source-caption review.

Only one image per admitted original post/outfit was retained. Group portraits with no single clear target were excluded. Similar black-veiled looks from the same artist, near-repeated red/black trouser styling, excessive outfit-obscuring costumes, and redundant combinations were left out rather than counted toward the target. Not every repeat appearance of a person was excluded: a genuinely different outfit can remain. No admitted photograph is grayscale, a collage, a child-focused look, nude, or an incidental clothes-poor portrait.

The original source watermark was retained. Image optimization uses Pillow EXIF transpose, RGB conversion, proportional LANCZOS thumbnail within 1100×1400, WebP quality 84/method 6, and atomic replacement. There is no cropping, stretching or generated imagery in the delivered assets.

### Review evidence and mappings

Scratch evidence is under `/home/.z/workspaces/con_CWRIVUZUMtmpnC4H/streetstyle/`:

- `candidates.json`: 160 post URLs, post IDs, image links, source descriptions and cached HTML paths.
- `source-age-exclusions.json`: source-age screening exclusions.
- `downloaded-candidates.json`: downloaded candidate mapping.
- `candidate-sheets/contact-01.jpg` through `contact-13.jpg`: all 145 reviewed candidates, numbered with original candidate number and post ID. All thirteen were opened with `read_file`.
- `candidate-sheets/mapping.json`: exact number → sheet → ID → source URL mapping.
- `visibility-review.jpg`: enlarged lower-garment/footwear audit for ambiguous cases.
- `admitted-review.json`: 106 accepted original candidate numbers, post dates and source descriptions.
- `admitted-sheets/`: nine regenerated accepted-only contact sheets and a sequential mapping. These are derived copies; the completed visual review used the original candidate sheets and enlarged audit.

For a durable rebuild of the admitted-only contact sheets, use the committed manifests and the `contacts` command below. The canonical final metadata is `scripts/streetstyle-photos.json`, not the provisional scratch admission script/TSV.

## Coverage

Family counts (unchanged by final visibility corrections):

| Family | Count |
| --- | ---: |
| expressive | 43 |
| soft | 20 |
| everyday | 17 |
| tailoring | 15 |
| sport | 8 |
| utility | 3 |
| **Total** | **106** |

All 14 legacy feature tags are represented. The corpus includes wide and cropped trousers, balloon shapes, long layers, narrow and flared forms, skirt lengths, shorts, one-color dressing, checked/printed/graphic surfaces, visible lace and fringe, tailoring mixed with sportswear, bright and subdued palettes, and both conspicuous footwear and comparatively simple shoes.

Clothing range: **105 unclassified, 1 men**. The one men's-range record is post 189186, whose source explicitly describes an oversized menswear look. Source labels such as “Guys” or “Girls” describe people and were not automatically converted into a clothing-range classification. All **106 frame values are unknown**; no body measurements, sex, or identity were inferred.

All use `metadataBasis: visual-review` and `sourceLabel: TokyoFashion`. Photographer names were not established, so all creator credits and the conservative `shoot` grouping are **TokyoFashion**. Per-post or per-day invented photographer groups were deliberately not used. Original post URLs are also retained as the metadata-only `licenseUrl`.

Dimension groups used are silhouette, surface, palette, styling, context, and selectively function/comfort. References are left absent where not explicitly supported. Comfort cues are limited to visibly roomy cuts, clearly flat footwear and visible adjustable closures; there are no claims of softness, stretch, breathability, warmth, waterproofing or physical fit. Function cues are limited to visible pockets. Missing groups remain unknown, not negative evidence.

### Important gaps

- This is a fashion-specific **Harajuku subculture supplement**, not a representative everyday wardrobe sample. Expressive styling, statement footwear and black layered looks are overrepresented.
- Source dates cluster in 2020–2022, with fewer 2023–2024 additions; these are archival references, not a current trend survey.
- Repeated street backdrops, lighting and several recurring wearers are still confounds even when outfits differ.
- Publisher/photographer diversity is intentionally only **one conservative group**. Do not treat 106 images as 106 independent shoots. Parent sequencing should tolerate this conservative grouping rather than relabeling every image as a new shoot.
- Fuller-body, older-adult, mobility-aid, professional-uniform, practical outdoor, and geographically broad representation is incomplete. No balance is claimed; frame and most clothing-range labels remain unknown.
- Activewear and functional utility are sparse; this workstream should be combined with the parent's broader everyday/editorial collection.
- Exact duplicate image/post validation is automated; same-outfit and visually near-duplicate exclusion was manual. There is no claim of a perceptual-hash certificate.
- Covered shoes, lower hems and ambiguous boot-versus-shoe distinctions fail closed using visibility booleans. Source-caption knowledge was not used to pretend an obscured shaft or heel is visible.

## Commands and verification

From the repository root, with Python, Pillow and (for discovery only) beautifulsoup4 available:

```sh
python scripts/streetstyle-import.py --help
python scripts/streetstyle-import.py self-test
python scripts/streetstyle-import.py validate --check-images
python scripts/streetstyle-import.py download
python scripts/streetstyle-import.py contacts --output /home/.z/workspaces/con_CWRIVUZUMtmpnC4H/streetstyle/rebuilt-contacts
python scripts/streetstyle-import.py discover --cache-dir /home/.z/workspaces/con_CWRIVUZUMtmpnC4H/streetstyle/rebuild-cache --starts 0 40 80 200
```

The importer never automatically admits discovered candidates. New admission still requires explicit visual review and Photo metadata. Downloading only uses the reviewed asset manifest and does not alter either parent catalog.

Verified before the command sandbox stopped:

- **8/8 embedded regression tests passed**: valid/optional dimensions; duplicate post; duplicate ID; invalid metadata/path/URL; garment visibility contradiction; asset bijection and duplicate image URL; EXIF transpose and proportional bounds; corrupt cached image rejection.
- **106/106 metadata/asset pairs passed validation**.
- **106/106 local assets passed full RGB WebP decode/bounds checks**, totaling 19,758,876 bytes, with no exact decoded-pixel duplicates.
- 160 candidate posts parsed from ordinary public HTML with zero parser errors after supporting TokyoFashion's `.post-content` container.
- Thirteen candidate contact sheets plus the enlarged visibility audit were actually viewed.

**Final validation limitation:** the command sandbox subsequently shut down (`Modal Sandbox ... not found`), and a second command attempt failed identically. Final conservative footwear flags and several source-confirmed garment corrections were applied with file tools after that point. The corrected JSON and any integrated parent catalog need a fresh `self-test`, `validate --check-images`, typecheck and application test run. Do not rerun the provisional scratch `admit.py`, which can overwrite final corrections. No service restart was attempted.
