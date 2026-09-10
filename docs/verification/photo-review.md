# Real-photography release verification

2026-09-10 UTC (2026-09-09 evening, America/New_York).

## Release scope

42 credited color photographs, including 10 beyond the research shortlist. Optional self-reported sex, independent women/men/all clothing collections, optional broad visual body-reference priority, 14 clothing features, reference library, notes, four reactions, explicit more/less signals, favorites and exports. Original illustration app and v1 browser data remain unchanged at `/illustrated`. New homepage uses its own v2 key.

The actual catalog contains 23 women's and 19 men's clothing references. Fuller-bodied references remain scarce, especially full-outfit menswear. This is explicitly disclosed, not presented as balanced or representative. No inferred biological sex, exact body measurements, fit simulation, stock-photo downloads, automatic product matching or analytics.

## Automated verification before deployment

- Frozen dependency install and TypeScript typecheck.
- 71 unit tests, 5,853 assertions; all pass.
- 49 Chromium browser tests; all pass against the actual production bundle.
- Desktop/mobile: 320, 390, 768 and 1440px layouts, axe checks, photo loading and original aspect ratios.
- All 42 photo assets load locally; catalog/manifest exclusion of held imagery checked.
- Retained 800 illustration render checks and all 26 legacy browser regressions at `/illustrated`.
- New tests cover setup selections, gallery and mosaic filtering, legacy preservation, unknown storage, storage failures, cross-tab writes, pending clear, missing-save recovery, dirty-draft confirmation, last-card undo, repeated activation, missing images, negative feature signals, skip disclosure and pending-save navigation.

Photo screenshots remain local under `docs/verification/photos-*.png` rather than being redistributed with the source repository. Browser source interception is disabled when TEST_BASE_URL points at the live site.

## Adversarial reviews and resolved findings

Two independent reviews were performed: a read-only source/asset review with isolated Chromium probes, and a final bounded review of the complete active source. An interrupted earlier engine delegation produced incompatible, unused drafts; those were preserved outside the release tree, not integrated or claimed as passing tests. Only photo-session.ts/use-photo-state.ts define the released v2 schema.

| Finding | Resolution and regression |
| --- | --- |
| Dirty draft silently lost on changing clothing range | Explicit confirmation, cancel preserves draft, known valid next card pinned. |
| Missing saved version discarded open work | Missing/unreadable reload preserves current work and reports conflict. |
| Transient read failure could unprotect unknown version | Protective invalid/conflict/clear-failed states cannot be downgraded to ordinary unavailable. |
| Storage writes/deletes could silently no-op | Read-back verification; error remains visible and in-memory data retained. |
| Pending reset could outlive dismissal or conflict with writes | Modal cannot be dismissed while clearing; serialized generation guard; compare saved value at confirmation under lock. |
| Other-tab clear could trap recovery | Explicit confirmed clear accepts current empty state; missing reload never silently discards work. |
| One visible high-heel outfit lacked its heel tag | Photo 5254744 description and heels metadata corrected; real-asset exclusion regression. |
| Explicit negative details ignored in suggestions | Candidate scoring includes negative as well as positive evidence, without making ordinary dislikes hard exclusions. |
| Skip claimed neutrality despite explicit negative chips | Copy distinguishes neutral outfit skip from retained intentional detail choices. |
| Branded accessory escaped initial hold | Photo 18220798 removed from catalog, download manifest and local public assets. |
| Last card could not be undone after exhaustion | Exhaustion screen retains Undo with normal stale/double-action guards. |
| Setup mosaic bypassed filters | Preview images derive from the same eligible collection as discovery/gallery. |
| Internal navigation could discard queued saves | Home is in-app navigation; legacy link blocked while saving/blocked; before-unload warning added. |

Tests are `tests/photo-session.test.ts`, `tests/photo-review.test.ts` and `tests/browser/photo*.spec.ts`, alongside retained legacy tests.

## Limits

Browser testing is not certification on physical devices or real screen readers. A forced browser shutdown can still lose pending work. Web Locks coordinate cooperating tabs only; unsupported browsers operate in memory and display a warning. No JSON import yet. Free copyright licensing does not establish individually verified publicity/property releases. Photo tags and broad body groupings are editorial judgments; pose/background/contributor effects remain confounds. The portrait describes provisional associations, not a validated psychological or causal preference model.

See `docs/photo-sources.md`, `scripts/photo-assets.json`, and `src/lib/photo-catalog.ts` for provenance and excluded images.

## Public deployment verified

Republished at https://stylr-hatsunemiku.zocomputer.io/ on 2026-09-10 UTC. All 49 Chromium browser tests passed again with TEST_BASE_URL pointing at that public URL and production-asset interception disabled (1.4 minutes). This includes all 42 same-origin photo assets, photo setup/discovery/portrait at four viewport widths, storage recovery and legacy /illustrated behavior. The 800 illustration geometry cases still render the locally compiled unchanged component inside the live page; they are not 800 separate server requests. A clean-directory source provisioning test fetched all 42 credited images successfully. No personal browser sessions were used; tests ran in isolated contexts.
