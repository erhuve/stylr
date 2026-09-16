# Catalog expansion verification

Privately deployed on 2026-09-16 at https://stylr-personal-hatsunemiku.zo.computer/ through `publish_site`. The previous public Stylr site was not changed.

- 1,460 app photos: original 385 preserved, 1,075 admitted additions across 698 source pages.
- 1,219 review records, 1,031 non-null build observations, 174 complete three-axis references. Broader build / similar shoulders and hips / moderate waist has 26 matches, previously 1.
- 124 unit tests and TypeScript pass. The exhaustive 1,460-card sequence test has a 120-second limit rather than the former five-second limit; it still traverses the entire catalog.
- Final isolated production build: all 86 browser tests pass, including every photo decoding, strict matching, persistence, draft protection, accessibility, gestures and the illustrated application.
- One original Punk Rave cape photograph has mean chroma 0.8025. Direct visual inspection confirmed low-color skin, hair and lips against mostly black/white clothing/background. Its explicitly identified browser-test lower bound is 0.5; all other images retain 1.0. No image was recolored or regenerated.
- Eight production browser checks pass on the internal endpoint in fresh contexts: four body-control checks and four responsive Start/swipe checks. Existing personal browser storage was not used.
- All 1,075 newly served image SHA-256 digests match reviewed originals. Production HTML matches the verified isolated build. The public-facing private URL returns a 302 sign-in redirect to unauthenticated requests.
- All 42 original visual identities and all 106 street-style image records validate. Admission replay and full library audit pass with zero duplicate image digests.

Implementation and provenance are copied into the live repository working directory. The follow-up repository consolidation includes body controls, admission provenance and research scripts/evaluation artifacts together. See `docs/catalog-pipeline.md` and `research/README.md` for the pipeline and reproduction boundaries.
