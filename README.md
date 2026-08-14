# One Hour Is Still One Hour

**Live at [baumol.charliedeck.com](https://baumol.charliedeck.com).**

A playground for Baumol's cost disease. It's 1999, in a town with two jobs:
software engineer and babysitter, both at $12 an hour. One button makes the
engineers repeatedly better at their job; nothing ever changes in the living
room. The piece animates the causal chain — productivity, wages, retraining,
the bidding war for the sitter's hour — then hands you the town's policy
levers: rate caps, batching, subsidies, a robo-sitter app, and the deeper
knobs (substitutability, retraining friction, wage pass-through, who gets the
gains). A deterministic two-sector economy runs underneath; every readout and
chart derives from it.

## Run

```sh
npm install
npm run dev        # http://localhost:6414 (host: true, strictPort)
```

URL flags: `?fast` compresses the narrated beats (used by e2e), `?seed=N`
seeds the visual jitter. `npm run preview` serves a production build on 6415.

## Quality gates

```sh
npm test           # vitest — the economics, pinned in 20 tests
npm run test:e2e   # Playwright, desktop + phone projects (dev server on 6416)
npm run lint       # tsc --noEmit (strict)
npm run build      # typecheck + vite build
```

## Where things live

- `src/model/` — the pure sim: no DOM, no clock, no randomness. `sim.ts` holds
  the two-sector economy (CES demand, shared labor market, training pipeline,
  policy levers); `eras.ts` the six tool eras; `params.ts` the dials.
- `src/app/` — engine (fixed-step driver), director (narration beats,
  inscriptions, crisis), store (zustand vanilla), policies.
- `src/ui/` — scene (the SVG town), charts, ledger, town hall, controls.
- `tests/sim.test.ts` — the pedagogy as assertions: three doublings ≈ 8×, caps
  create queues, subsidies move the bill, concentration splits affordability.
- `DESIGN.md` — the original design brief the piece implements.
