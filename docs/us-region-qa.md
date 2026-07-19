# US region — QA audit (2026-07-19)

Overnight pass on the live US roster after the "partial crop / celebrations
not correct" report. Method: render every fighter's 18 frames at **in-game
scale** with the cel-buffer bounds + ground line drawn, plus live
fight/celebration/mobile screenshots.

## Fixed & shipped to production

- **Advocate scale** — spec/block/hurt/ko/victory frames were drawn ~1.4–1.8×
  smaller in the source sheet; the character shrank/looked cropped in those
  poses (worst during the victory-frame celebration). Re-packed with per-frame
  normalization zoom → all 18 frames now render at a consistent size, feet on
  the ground line. (commit on `main`)
- **Region sash** — US champions now wear a red/white sash (blue rosette)
  instead of the Brazilian green/yellow one.
- **Draw celebration** — now renders the actual fighters (was hard-coded Zé +
  Capitão) with a localized bubble ("NOT THIS TIME!").

## Fixed, staged on branch (awaiting deploy approval)

- **Mobile select overflow** — the US roster ran ~4px taller than BR at 390px
  landscape, clipping the bottom premium row (Madam/Podium) below the fold.
  Trimmed the US premium spacing in the landscape breakpoint; all three rows
  now clear the fold. CSS-only, US-scoped, BR untouched.

## Audit result — the rest of the roster

| Fighter   | Scale / feet          | Notes |
|-----------|-----------------------|-------|
| hope      | consistent, aligned   | victory frames ~10% compact — normal variation |
| dealmaker | consistent, aligned   | clean across all 18 |
| advocate  | **fixed**             | — |
| madam     | consistent, aligned   | **outfit color flickers** (see below) |
| bebest    | consistent, aligned   | f10 compact but fine |
| podium    | consistent, aligned   | distinctive podium mic-drop victory |

No other cropping or floating found — advocate was the only real scale defect.

## Open item for your decision

- **Madam's suit changes color between frames** (blue idle / magenta walk /
  green hurt) — the source sheet drew her in multiple outfits, so her suit
  flickers as she moves/attacks/gets hit. Not a crop, but it reads as a quality
  glitch for a paid fighter. Fixing means recoloring frames to one canonical
  suit color — subjective + non-trivial, so I left it for you to call rather
  than guess overnight. Options: (a) recolor all to the blue idle suit,
  (b) recolor to magenta, (c) leave as-is. The other five fighters are
  color-consistent.

## Still yours to drive

- Online 2-phone lockstep validation (untestable in the sandbox).
- US title key-art (currently the canvas "DUELO USA" wordmark) — send a sheet
  and it gets plotted like the BR key art.
- Cross-region online (BR-vs-US) is currently allowed; say the word to gate it.
