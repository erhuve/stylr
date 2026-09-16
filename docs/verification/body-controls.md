# Body controls release verification

## Continuous controls revision

Deployed privately on 2026-09-14. Seven checks pass against the running production endpoint: body filtering with dirty-draft protection, empty results, fractional selection persistence, and four Start/swipe viewport checks. The external URL redirects unauthenticated requests to Zo sign-in. Production checks use isolated browser contexts on the internal endpoint.

The redesigned setup replaces optional axis checkboxes with three required continuous proportions, visible endpoints and an SVG shape guide. Nearby photo matching requires all axes to be reviewed within fixed tolerances; no predictions or invented finer labels are used. Legacy saves retain exact matching until applying setup. Source changes remain uncommitted.

Pre-release checks: TypeScript, 122 unit tests and all 85 browser tests pass, including fractional persistence, unknown exclusion, bounded proximity, dirty-draft cancellation, empty results, accessibility and Start/swipe geometry at 320×640, 390×844, 768×1024 and 1440×900. All 385 assets validate; 42 original photo identities and 106 street-style records/images validate. Mobile screenshot: `body-controls-mobile.png`.

## Previous release

Privately republished on 2026-09-14 at https://stylr-personal-hatsunemiku.zo.computer/. The previous public Site was not modified. Changes are present in the personal repository working directory and remain uncommitted.

- TypeScript check and 121 unit tests passed, including all 80 build/shoulder/waist combinations and legacy-session parsing.
- Full browser suite: 84 tests passed. Final compact layout also passed five targeted start/continue and responsive checks.
- All 385 local photo assets verified; all 42 original photo identities preserved. Street-style validation passed for 106 records and images.
- Four imported review/ID files exactly match the second experiment's source files.
- After publishing, six checks passed against the running production server: body filtering, persistence and draft protection, empty strict combinations, and start/swipe geometry at 320×640, 390×844, 768×1024 and 1440×900.
- The external homepage redirects unauthenticated requests to Zo sign-in. Production browser checks used the internal endpoint in isolated contexts; no existing personal browser storage was used.

Reviewed references provide approximate visual categories only. There are 124 reviewed build references, with sparse fuller-build coverage. Selected unknown traits are excluded, empty combinations remain empty, and algorithm predictions are not used. Filters hide saved reactions without deleting them.
