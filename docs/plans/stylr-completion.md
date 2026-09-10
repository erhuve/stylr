# Stylr completion plan

Status: implementation and two rounds of adversarial validation complete; repository handoff. 2026-09-09 America/New_York.

Scope: finish the fashion-style discovery prototype and push to erhuve/stylr. This is not the wardrobe inventory product. The old style-study directory contains separate concurrent work; the canonical completion directory is Sites/stylr, with its own system-generated runtime config.

## Product decisions

Retain the curated three-screen experience: adjustable illustration, exploration, tentative portrait. Complete this transparent finite prototype rather than add an AI stylist, live product inventory, accounts, or a backend personal-data store. Warm editorial typography, paper/olive palette, self-hosted fonts, one parametric figure renderer.

Protected behavior: 24 looks across six directions; body settings never filter style; admiration and wear stay separate; only wear suggests shopping; no forced positive label for all-pass/unsure; explicit more/less tags guide selection; notes remain plain text; four explicit shopping exclusions; budget is only a search hint; reversible votes, draft resume, portable export and deliberate reset.

## Work sequence and acceptance

- Reconcile mismatched prototype contracts and route the real screen at the root. Reuse FashionModel for every figure; remove dead alternative renderer from this isolated project. Theme tokens live only in theme.json.
- Validate stored payloads, reject duplicate/contradictory votes and traits, normalize stale drafts and impossible screen states. Compare and save inside Web Locks; preserve corrupt/conflicting/unreadable versions, fail safely if storage/locks are unavailable.
- Confirm before undo replaces unfinished feedback. Make failed reload/clear preserve work and report failure. Guard repeated input and announce the successor outfit.
- Test adaptive exhaustion, all reaction types, exclusions, safe export, adversarial persistence, mobile/touch/keyboard and modal focus. Verify 800 figure renders across all 32 slider extremes. Inspect screenshots and run axe at 320/390/768/1440.
- Independent read-only adversarial review, reproduce findings, fix and retain regression coverage. Typecheck, production build and all tests before committing.
- Fetch remote before push, integrate concurrent remote changes rather than overwrite. Use required Miku author / Zo committer plus coauthor trailer. Verify remote commit hash.

## Explicit limits

No public publishing requested. The managed development preview is currently not listening; do not start/restart it manually. Browser acceptance uses the actual production assets via Playwright route fulfillment, not a mocked app. This validates UI behavior but not Zo hosting/proxy availability. Real assistive-technology and physical-device testing remain unperformed.
