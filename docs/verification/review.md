# Stylr verification and adversarial review

2026-09-09, America/New_York. Scope: canonical Sites/stylr implementation, not the separate unfinished style-study checkout.

## Verified

- Frozen-lockfile dependency install succeeds; TypeScript and Vite production build pass.
- 52 unit tests, 5,455 assertions: hostile saved payloads, scoring, order-independent ties, no positive result from all-pass/unsure, wear versus admiration, deterministic complete traversal, draft/undo behavior, all 16 shopping-exclusion combinations, safe Markdown and search URLs.
- 26 Chromium browser tests pass against the actual production bundle. Tests cover all three screens at 320, 390, 768 and 1440 pixels, no page/console warnings or errors in those flows, no horizontal document overflow, and zero axe WCAG A/AA violations in those checks.
- 800 SVG renders: all 32 extremes of the five body sliders across 24 looks plus the neutral figure, cycling hair/skin. All remain in their viewBox, with finite geometry, unique IDs and valid definition references. Independent slider changes alter neutral and clothed paths.
- Real browser storage faults, origin-wide Web Lock contention, corrupt/future payload preservation, failed clear/reload, no-lock fallback, draft detours/reload, repeated click/held Enter, complete 24-look traversal, downloads, native dialog focus, and CDP touch/cancel paths are covered.
- Screenshots in this directory come from fixture studies, not personal user data. Figure, discovery and portrait files exist for each viewport. Desktop and mobile screenshots were visually inspected.

## Independent adversarial findings and resolutions

A separate read-only reviewer examined the engine, persistence hook, UI and tests and ran isolated fault/concurrency probes. These findings were addressed before the final validation run:

| Finding | Resolution and regression |
| --- | --- |
| Undo silently replaces the current unfinished draft | Confirm before discarding nonempty note/tags; cancel and download options; preserve previous reaction feedback on undo. Browser regression verifies cancel and explicit discard. |
| Read-then-write localStorage race across tabs | Serialize comparison and writes inside an origin-wide Web Lock; loser retains its in-memory version and receives a conflict warning. Contention test holds the lock while both tabs queue competing edits. |
| Failed reload replaces unsaved work with an empty session | Failed read/parse retains current in-memory study and reports failure, rather than announcing success. Fault-injection regression retains the unsaved note. |
| Failed clear announces success while data remains | Delete first, reset only on success. Failure keeps visible/exportable state, explicitly warns that data remains, and supports retry. |
| Successor outfit is silent to assistive technology | Live region includes the next outfit name and pieces, with stable focus. Assertions verify announcement content; no claim of a physical screen-reader test. |
| Repeated activation can rate successor cards | Short action lock, native double-click detail check, held-key suppression, and undo protection. Slow double-click and repeated Enter regression tests pass. |
| Floating-point order alters equivalent portraits | Sum integer weights then normalize; reordered-equivalent evidence has exactly equal scores and portrait output. |
| Follow-up: pending clear can survive dismissal or revive queued private data | Clear is now an exclusive transition: disable dismissal/re-entry/editing, invalidate snapshots before and after deletion. Real held-lock regression confirms Escape cannot cancel a committed pending clear and the data stays deleted after reload. |
| Follow-up: slow double Undo removes two reactions | Both Undo entry points reject duplicate click detail. Browser regression uses a 450 ms double-click and asserts exactly one removal. |

## Remaining limitations

- The managed development process stopped responding during verification. No server was started/restarted manually and no public deployment was requested. Browser tests load the actual dist assets through Playwright request fulfillment at a test origin; they verify the application, not the Zo hosting/proxy layer. The private preview URL is documented but is not claimed reachable at handoff.
- Physical phones and actual assistive-technology sessions were not tested. Automated accessibility checks and synthetic/CDP input are narrower evidence.
- Browser-local persistence only. There is no cloud sync or JSON import. Browsers without Web Locks can explore/export but do not save automatically. A tab forcibly closed while a save waits for a lock can lose its pending changes; the save indicator distinguishes pending work.
- The catalog is deliberately small; figures are illustrations, not fit predictions. Shopping links are unverified external searches, not live prices, stock or purchase recommendations for admired-only looks.
- Third-party Rollup annotation warnings occur in the production build; the build succeeds. They are distinct from the clean browser-console checks.
