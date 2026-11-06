# Status

_Last updated: 2026-11-03_

## Done

- **Model** (`src/model/`): two-sector town; factory pay tracks output (with a pass-through share); service pay is sticky (revised only after ~0.8 years of strain), so gaps open, people walk, then providers answer. CES demand with income tilt and essential floor; six institutions (subsidy, public provision, frozen budget, wage cap, caseload, automation, quality standard); income distribution with flat or exemption-based progressive tax; unserved households split into priced out, rationed, and chose an alternative. Unit-tested.
- **Sim** (`src/sim/`): a run is a `Course` (rules over time, length) advanced in whole fixed steps, so on-screen and headless runs agree exactly.
- **Essay**: styled as a news feature (section label, headline, dek, byline, captioned lead art, endnotes), with study links woven into the prose. Lead art plus ten figures: the hats tutorial with a model-driven narrated causal chain and ledger; minutes/equation/money framing; morph across ten settings; the labor-market bridge and pass-through; what an hour buys; seven responses with a report card; two claims (cost disease vs structural change); household affordability with market and tax lenses; a casebook of eight industries (live music, health, education, childcare, restaurants, home repair, legal advice, AI code review), each run for 40 years with its own twist and set beside the published evidence; the lab with URL-encoded settings, which the casebook can load.
- **Craft**: compact phone composition, light and dark themes, reduced motion, optional synthesized sound, per-figure CSS with tone tokens.

## Review log

- Four cycles of thermo-nuclear code review + design review, each acted on. Final design scores: aesthetics 8.5, interactivity 7.5, delight 8, educational value 8.5 (before the last round of fixes).
- 2026-10-10: news-feature restyle, two new settings (home repair, legal advice) and the casebook; a fifth thermo-nuclear review, acted on (casebook claims pinned by `tests/casebook.test.ts`; lab handoff via `openLab`, with controls synced in place).

## Isometric pilot (in progress)

- `?iso` swaps every town figure to `src/scene/iso/`: a diorama slab with the street between the two lots, generated sprites (one factory in four machine stages shared by every setting; barbershop and care house with blank clocks for live SVG hands; six toy characters, each drawn standing and walking in both outfits so a person keeps their look when they change jobs), and the same live SVG overlays as the flat scene (board, signs, porch seats, hiring card, gate on the zebra, queue).
- Settings other than hats and care borrow the care house until their buildings are drawn.
- Source art and concepts live in `art/` (untracked); `scripts/sprites.py` trims generated buildings into WebP sprites and `scripts/people.py` cuts the character sheets in `art/people/`.

## Layout

- The simulator plates (Figs 1, 3, 4, 6 and the lab) are `plate--sim`, 54rem: a little wider than the 42rem text. Town plates under 900px use the compact composition (wage strip under the drawing).
- Figs 1, 4 and 6 use `duo(left, right)` from `src/figures/common.ts`: on plates 760px and wider the town sits in the left column (sticky when it's alone there) with controls and readouts on the right; narrower plates stack, and anything under the town moves below the controls.
- Fig 1's ledger sits in the right column; Fig 6's report card sits under the town, and its seven responses are title-only chips (the chosen one's description shows under the run bar).
- The flat scene is a wide strip, so in the left column its board text gets small. The iso scene fits the column better.

## Open

- Fig 3 wage boards show each setting's own goods units (captioned, not normalized).
- Lab desktop layout leaves some empty space beside the long control column.
- Lab desktop: the left column could become sticky so Distribution sliders keep visible feedback.
- Fig 8: the y-axis meaning changes between lenses without a transition.
