# Stylr body-reference labeling worktree

**This is an isolated checkout at `Code/stylr-body-labels`, branch `body-reference-labeling`. It does not back a service. Do not publish it, start an entrypoint, or modify either live Site directory. Its photo assets and node_modules are read-only links to the active personal Site; this labeling pass needs no browser build or dependency changes.**

Latest direction (2026-09-14): Miku wants body shape/size preferences front and center before swiping, richer than the existing frame categories, with strict matching rather than a gentle ordering hint. The current authorized step is to label the existing **real** photographs; generated augmentation and the body-control UI are deferred. Missing or garment-obscured body traits remain unknown and must not silently pass future filters. Earlier optional-body-setup guidance below describes the deployed UI, not the new intended behavior.

The following retained project guidance describes the deployed baseline at `Sites/stylr-personal`, not this isolated worktree:

- This is the active personal-use iteration of Stylr, on `personal-discovery` in `erhuve/stylr`. Read README.md and docs/plans/personal-discovery.md first.
- Privately published at https://stylr-personal-hatsunemiku.zo.computer/ with owner sign-in required. Production is independent of the development preview. This working directory now backs a live service: rebuilding `dist` changes served assets. Use an isolated checkout for future pre-release builds, and deploy deliberately through `publish_site`.
- `Sites/stylr` is a separate working directory for the previous public release. Do not run builds, change source, or move this work there without an explicit deployment decision.
- Keep one photograph and the four reaction choices plus undo easy to use above the fold. Starting requires no profile or comfort questionnaire. Notes, settings and explicit attributes are secondary disclosures.
- Preserve `stylr:photos:v2`, original photo identities and original `/illustrated` behavior. Do not silently migrate IDs, discard notes or weaken storage-conflict/failure protection. Different origins retain separate browser storage; publishing does not transfer preview sessions.
- Missing photo metadata stays unknown. Unclassified clothing references are included in All looks, not in strict range selections. Comfort labels describe visible cues, not inferred fabric performance or fit.
- The combined catalog is immutable. Normalization, contributor grouping, uncertainty-aware breadth and overlap associations have adversarial regression tests; retain cache invalidation and bounded memory/work.
- Photo assets and photo-containing screenshots are local ignored artifacts. Keep source manifests and review notes reproducible. This experiment does not need a licensing, commercial product, account, analytics or shopping workflow.
- Verify types, unit tests, image manifests and browser tests in the chosen isolated worktree before release. The default test harness serves a local build through request interception; `TEST_BASE_URL` selects deliberate live checks. Do not manually start a Site entrypoint. Run the original-photo visual check after regenerating assets.
