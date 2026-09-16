# Reviewed apparent-body references

The application now also imports admitted expansion observations from `../catalog-review/admitted-body.json`. Together these provide 1,219 reviewed records and 174 complete references across 1,460 photos. This directory remains the unchanged original 144-review provenance; its counts below describe that historical subset.

Imported from `Documents/stylr-shape-clustering/v2` on 2026-09-14. The two review files and their paired ID mappings are copied unchanged. Row indices bind to those exact mappings; do not reorder either independently.

The primary assistant directly reviewed 96 calibration photographs and 48 disjoint confirmation photographs. Of these 144 records, 124 have apparent-build observations: 24 slender (1), 70 slender–intermediate (1.5), 21 intermediate (2), 5 intermediate–fuller (2.5), and 4 fuller/broader (3). Shoulder/hip balance uses -1 for hips broader, 0 for similar width, 1 for shoulders broader. Waist definition uses 0 for straighter, 1 for moderate indentation, 2 for pronounced indentation. Null means unknown, independently per trait.

These are subjective visual references through clothing, not measured anatomy, actual clothing sizes, fit predictions or verified person identities. They use a different rubric from the earlier conservative anatomical annotation pass. Algorithm estimates are excluded from this dataset and from strict matching.

New selections require all three reviewed axes, with fixed maximum distances of 0.5 build units and 0.75 shoulder/hip and waist units. These tolerances support smooth preference controls without inventing finer photo annotations. Preview ordering uses squared distance across the three equally scaled axes. Legacy saved selections without `mode: nearby` retain exact equality and optional axes until the user applies the new setup. No reviewed matches means an empty selection, never an automatic fallback. All original photo IDs and assets remain unchanged.
