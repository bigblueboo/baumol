# Status

_Last updated: 2026-08-11_

## What this is

"One Hour Is Still One Hour" — an interactive Baumol's cost disease
explorable (software engineer vs babysitter), per `DESIGN.md`. Single-page
Vite + strict TS, no framework. Dev port 6414, preview 6415, e2e 6416
(e2e serves the production preview build — no HMR flakes).

## Quality state

- 29 unit tests green (economics invariants incl. pass-through invariance
  of the relative-price gap, honest-metrics accounting, URL flag parsing,
  engine partition-invariance).
- 12 e2e green + 4 project-scoped skips, full suite ~1 min single-worker.
- Expert (GPT-5.6 Pro) reviews: round 1 (all P0-P2 addressed), round 2
  (B+, narrative choreography — addressed: beat-gated mechanisms, vote
  after the finale, unified dwell, ?fast fix, robo budget consistency,
  honest metric labels), round 3 (**A−, no P0s**; both P1s fixed: shared
  installed() predicate for the finale, forward-looking pass-through copy
  with settled-state narration). Raw reviews in /tmp/expert-review-{1,2,3}.md.
- Thermo-nuclear structural review: raw verdict NEEDS RESTRUCTURING.
  Verified-and-fixed: scene now consumes engine-reported sim time (no
  second clock), applyParams recomputes capacity before deriving, policy
  votes unpause, town-hall knobs fully typed (no casts), e2e hook typed.
  Verified-but-deferred (see below): unifying the narrative state machine
  into one discriminated union, and the policy-as-union refactor.

## Architecture notes

- `src/model/sim.ts` — pure two-sector economy; `step(s, p, dt, gates)`
  where `Gates` freezes wage/labor/sitPrice/demand during narration beats.
- `src/app/director.ts` — beats, inscriptions, one-shot observations;
  narrative clock advances by achieved sim progress (engine returns
  consumed weeks), so words can't outrun numbers.
- Reset = `location.reload()` on purpose (only full reset that resets all).
- Inscription overlay hides *instantly* on close — a fading ghost overlay
  intercepted clicks for minutes in e2e (found via trace).

## Known gaps / next

- Deferred restructurings from the thermo-nuclear review (valid, not
  blocking): collapse phase/beat/unlock-booleans/pressCount into one
  discriminated `StoryStage` union with a pure transition function;
  represent policy as a typed union instead of id + param patch; move
  store writes behind named actions. Do these before adding the
  DESIGN.md scenario selector (education/healthcare/etc.).
- Cross-browser QA (Safari/WebKit, Firefox), screen readers, zoom, and
  forced-colors are untested — WebKit can't launch reliably on this box.

## Deployment

- Live at https://baumol.charliedeck.com (Netlify site `baumol-charliedeck`,
  id 8c2d4a33-c7e6-4a39-ad84-113ee19cea4f, team charliedeck).
- Public repo: https://github.com/bigblueboo/baumol — push to `main`
  deploys (build `npm run build`, publish `dist`, Node 22 via netlify.toml).
- charliedeck.com is on Netlify DNS, so the subdomain and TLS provisioned
  automatically from `custom_domain`.
