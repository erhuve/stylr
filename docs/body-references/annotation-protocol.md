# Stylr real-photo body reference labeling protocol

Scope: label all 385 existing real photographs to prepare richer, front-and-center body preferences. No generated images, reshaping, measurements, UI change or deployment in this pass. Worktree: /home/workspace/Code/stylr-body-labels; both live Site directories are read-only. User explicitly chose real photographs now; generated augmentation is deferred.

## What is being labeled

These are broad visual judgments about proportions supported by a photograph, not anatomical measurements, body-fat estimates, clothing sizes, height, weight, health, sex, gender, age or identity. Do not label any of those attributes. Do not use existing frame labels, clothing descriptions, source captions or the person's face as evidence. Inspect the actual pixels. Clothing silhouette is NOT automatically body shape.

Four independent ordinal axes support later visual controls. The values 0–4 are anchors, not centimeters, ratios, probabilities, or precise continuous estimates. Each supported axis receives a range of one or two adjacent anchors plus confidence medium/high; otherwise null. Unknown must never be treated as a match.

- build: 0 very narrow visible build, 1 narrow, 2 intermediate, 3 fuller, 4 substantially fuller. Judge visible torso and lower-body outline together. Do not extrapolate an overall build solely from face, hands, bare arms, calves or ankles. A concealed trunk or hips normally makes build null.
- shoulderHip: 0 hips clearly broader than shoulders, 1 hips somewhat broader, 2 visually comparable, 3 shoulders somewhat broader, 4 shoulders clearly broader. Both shoulder and hip extents must be visible, near-frontal and not materially altered by shoulder padding, puff sleeves, full skirts, loose coats, rotated hips or occlusion. Otherwise null.
- waist: 0 very little visible waist indentation relative to upper torso and hips; 1 slight; 2 moderate; 3 pronounced; 4 very pronounced. This is the visible waist relationship, not a waist size. A belt, corset, peplum, shaped blazer, gathered/full skirt, loose top or obscured waist is not evidence of the underlying waist. Favor null over garment-shaped false certainty.
- legs: 0 visibly shorter legs relative to torso, 1 somewhat shorter, 2 intermediate, 3 somewhat longer, 4 visibly longer. Must see the full standing body, the anatomical hip/leg transition sufficiently clearly, and lower legs/foot position without substantial heel/platform/perspective distortion. High-waist hems, posed bent legs, seated views, high heels, platforms, crops, oblique camera angles and hidden crotch/hip landmarks generally make this null. Never infer height.

Use a singleton range only when the anchor is visually well supported. High confidence is rare: clear body contours through unstructured close-fitting clothing, useful pose, no material confound for that axis. A single confidence refers to the supported axis, NOT to the person's real measurements. Do not use low-confidence numeric guesses: use null and document why.

## Record format

Write a JSON array. Exactly one record per assigned photo, with these fields only:

```
{
  "photoId": "the exact assigned ID",
  "pose": "front|three-quarter|side|back|seated|mixed",
  "axes": {
    "build": {"range": [1, 2], "confidence": "medium"},
    "shoulderHip": null,
    "waist": null,
    "legs": null
  },
  "blockers": ["loose-clothing", "structured-clothing"],
  "evidence": "Concise observation of what is visible and what hides the other traits."
}
```

Allowed blockers: loose-clothing, structured-clothing, layered-clothing, waist-obscured, hips-obscured, shoulders-obscured, cropped, turned-pose, seated-pose, bent-pose, heels-platforms, camera-perspective, occlusion, multiple-people, low-resolution.

Use [] if none. Evidence: 15–60 words, factual/nonjudgmental, ties assigned axes to visible support and explains missing axes. No aesthetic value judgments. Do not call the person healthy/unhealthy, attractive, normal, overweight, male/female, etc. Photo pose is the most important target's pose; a full outfit does not automatically make a valid body reference. Fully unknown records are a useful result, not a failure. No quotas for known labels or body groups.

## Review

View EVERY assigned contact sheet via read_file. Each sheet has six numbered photos with exact IDs; mapping JSON records the original paths. Inspect original images individually whenever a numeric annotation would otherwise be uncertain; you can instead leave that trait null. Never infer labels from the filename, title or style tags. Return the IDs examined individually and the sheet paths actually viewed in a separate brief report.

Parent derives usability deterministically: complete = all four axes supported; partial = at least one but not all; unavailable = no supported axes. This does not assert that a partial photo can satisfy a complete body profile. Labels will be stored separately from the original photo/frame/session schema and will not yet change the feed.
