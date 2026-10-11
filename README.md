# One Hour Is Still One Hour

**Live at [baumol.charliedeck.com](https://baumol.charliedeck.com).** Deployed by Netlify on every push to `main` (`netlify.toml`).

An explorable explanation of Baumol's cost disease. A small town has a factory whose machine keeps getting better and a service (a barbershop, then a care house) where an hour of work still takes an hour. Press a button and watch the wage gap open, workers walk, and the service price climb, then follow the same engine through what a town can do about it, the demand assumption behind "services will eat the economy", who can still afford care, a casebook that runs eight real industries through the model beside what studies of each have found, and a lab with twelve settings from schools to plumbers to AI code review.

## Run

```sh
npm install
npm run dev
```

The dev server listens on port 6170 on all interfaces: <http://localhost:6170>, or `http://m4air:6170` over Tailscale. `npm run preview` serves the production build on 6171.

URL hooks: `?silent` locks sound off, `?fast` runs every figure four times faster (used by the e2e tests), and `#lab?s=<scenario>&<param>=<value>` opens the lab with settings (the lab writes these itself; use **Copy link**).

## Quality gates

```sh
npm test            # vitest: model, URL codec, formatting
npm run test:e2e    # Playwright, desktop and 390×844 phone (port 6172)
npm run lint        # tsc --noEmit, strict
npm run build       # typecheck + production bundle
```

## Layout

- `src/model/` — the economy. Pure, deterministic, DOM-free: `economy.ts` (state, `observe`, `step`, `settle`), `residents.ts` (income distribution and access), `params.ts` (zod schema), `scenarios.ts` (the twelve settings).
- `src/sim/` — fixed-step driver (`townSim.ts`) and the shared, visibility-aware animation loop (`loop.ts`).
- `src/scene/` — the SVG town: buildings, people, noticeboard, icons.
- `src/charts/` — a small direct-labelled XY chart.
- `src/figures/` — one module per figure; `lab/` holds the sandbox, its control spec and its zustand store. `casebook.ts` holds the eight industry cases (rules over time, intuition, evidence, sources) and runs them headlessly; `cases.ts` draws them; `runCharts.ts` holds the run charts the casebook and lab share.
- `index.html` — the essay text; figures mount into `[data-figure]` hosts as they near the viewport.
