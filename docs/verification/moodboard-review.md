# Photo-first moodboard verification

## Scope

Replace the photo-study result page's explanation-first layout with a Pinterest-like photo board. Prioritize useful content above the fold and minimize unnecessary scrolling without shrinking essential controls or removing information. Scoring, source catalog, profile semantics, exclusions, local storage and the original illustrated study are unchanged.

- Your picks contains actual would-wear and admire reactions with separate visible labels.
- Would wear, Admire and To explore are distinct views. Suggested references are never presented as confirmed favorites.
- All views respect current clothing range and exclusions; hidden favorites stay saved.
- Full photo proportions, source credits and license links remain intact.
- Complete evidence, downloads, undo and library access remain available through Style notes. This is progressive disclosure, not deletion.
- Empty, all-skipped, filtered and exhausted boards have non-diagnostic explanations.
- Original `stylr:photos:v2` persistence and legacy `/illustrated` remain unchanged.

## Independent adversarial review

A separate read-only review of the scoped component, CSS, parent diff and tests found two P2 issues. Both were fixed and given browser regressions:

1. Exhausted positive sessions incorrectly implied insufficient discovery. The untried-suggestions empty state now uses neutral availability wording.
2. Retrying a failed image discarded keyboard focus. Retry now remains mounted during requests; repeated failures preserve button focus, while success moves focus to the stable figure before normal link navigation resumes.

The independent review was static. Executed browser regressions validate the fixes and the integration.

## Browser acceptance

13 dedicated moodboard tests cover:

- 320×640, 390×844, 768×900 and 1440×900 viewports.
- At least two complete photos visible without scrolling on the tested phone viewports and at least three on the tested tablet/desktop viewports, with a 20-pick seeded board.
- First photo begins before 380 px on phones and 310 px on tablet/desktop.
- Natural image aspect ratios, no horizontal overflow, primary controls visible, and WCAG A/AA automated checks.
- Actual favorites versus admiration versus suggestions; no invented favorites from skips.
- Clothing/garment boundaries applied to every view, without altering votes.
- All evidence retained; notes focus trap, Escape and focus return; JSON download.
- Undo confirmation and focus handoff; reference library still accessible.
- Exhausted recommendation copy and failed-image keyboard retries.

Screenshots are generated at `docs/verification/photos-moodboard-{320,390,768,1440}.png`. They are intentionally gitignored because they contain licensed source photos. Tests use isolated synthetic sessions, not personal saved studies.

A viewport-fold check on a seeded board is not a guarantee for every translation, text-zoom setting, storage warning or browser chrome size. Longer boards still scroll naturally; secondary detail is available on demand rather than forced ahead of the pictures.
