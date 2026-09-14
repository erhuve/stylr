# Stylr — real-photo body-reference labeling

Status: labeling and verification completed, 2026-09-14. Isolated worktree: `Code/stylr-body-labels`, branch `body-reference-labeling`, based on the deployed `personal-discovery` branch. Neither live Site is modified or deployed by this pass. All 385 photos have source-bound observations and second-pass review coverage; 42 have partial support and none support all four axes. See `docs/body-references/report.md` for results and limits. The body-control UI and further sourcing remain future work.

## Latest direction

Body shape and size preferences should be front and center before outfit discovery, richer than the old frame categories, and selected traits should strictly constrain the images shown. Real photographs are the current source; generated augmentation is deferred. The current step is labeling the real library, not implementing sliders or changing the live feed.

This supersedes the earlier optional-body-reference product direction. The deployed baseline still uses its existing optional frame preference; historical documentation of that behavior is not the intended future design.

## Deliverable

- An observation for every one of the 385 existing photographs, separate from Photo and session schemas.
- Four independent broad visual axes: build, shoulder-to-hip balance, waist definition, and leg-to-torso proportion. Each is an ordinal uncertainty interval with confidence, or explicit unknown.
- Source URL and exact image-byte binding, pose, visible-obstruction notes, and a reproducible validation/coverage command.
- Primary visual review, an independent check of supported labels, and a second pass for missed support. The initial unknown sample found missed labels, so the second pass is extended to all remaining unknown photographs.
- A coverage report distinguishing completed annotation records from photographs that support a selected combination of body traits. No invented midpoint, inferred measurements, clothing-size labels or demographic/health classification.

The rubric is in `docs/body-references/annotation-protocol.md`. Clothing silhouette is not automatically body shape; however, broad visible contours may support a label without measured anatomy. Review should catch both unsupported certainty and excessive use of unknown.

## Protected behavior

Preserve every existing photo identity and source asset, `stylr:photos:v2`, notes and undo, storage-conflict safeguards, and `/illustrated`. Do not wire provisional labels into the feed. No new images, reshaping, production build, service action or deployment. Worktree asset/dependency links are read-only.

## Following work

Use the reviewed coverage to design the body controls and strict matching. Do not silently substitute unrelated images when no supported matches exist. Broaden the real-photo corpus where needed; clear body-reference photographs linked to outfit photos by explicit publisher/model identifiers are preferable to treating a coat or flared skirt as evidence of the body beneath it. Do not infer identity by facial similarity.

Earlier app implementation and deployment evidence remains in `docs/verification/personal-discovery.md` and Git history. This is the single active plan for the current body-reference work.
