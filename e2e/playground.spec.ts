import { expect, test, type Page } from "@playwright/test";

/**
 * The full loop, driven the way a reader would drive it, with assertions on
 * the deterministic sim state via the window.__town hook. All runs use ?fast
 * (compressed narration beats) and a fixed seed.
 */

interface TownState {
  d: { ratio: number; coverage: number; publicShare: number; roboShare: number };
  sim: { wSit: number; wEng: number; week: number; sitters: number };
  phase: string;
  pressCount: number;
}

function town(page: Page): Promise<TownState> {
  return page.evaluate(() => {
    const st = window.__town.store.getState();
    return {
      d: {
        ratio: st.d.ratio,
        coverage: st.d.coverage,
        publicShare: st.d.publicShare,
        roboShare: st.d.roboShare,
      },
      sim: {
        wSit: st.sim.wSit,
        wEng: st.sim.wEng,
        week: st.sim.week,
        sitters: st.sim.sitters,
      },
      phase: st.phase,
      pressCount: st.pressCount,
    };
  });
}

async function pressWhenReady(page: Page): Promise<void> {
  // Poll-and-click: tolerates the button being mid-swap ("installing…")
  // or transiently busy without wedging the whole test on one assertion.
  await expect
    .poll(
      async () => {
        try {
          const btn = page.locator("#invent");
          if (!(await btn.isEnabled())) return false;
          await btn.click({ timeout: 2_000 });
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 60_000 },
    )
    .toBe(true);
}

async function dismissInscriptionIfShown(page: Page, timeout = 3_000): Promise<void> {
  const btn = page.locator("#inscription-continue");
  try {
    await btn.waitFor({ state: "visible", timeout });
    await btn.click();
  } catch {
    // no inscription appeared; fine
  }
}

test("opens at parity, everything calm", async ({ page }) => {
  await page.goto("/?fast&seed=7");
  await expect(page.locator("h1")).toContainText("One hour");
  await expect(page.locator("#invent")).toContainText("Install IDEs");
  await expect(page.locator("#ledger")).toBeHidden();
  await expect(page.locator("#charts")).toBeHidden();
  await expect(page.locator("#crisis")).toBeHidden();
  const st = await town(page);
  expect(st.d.ratio).toBeGreaterThan(0.95);
  expect(st.d.ratio).toBeLessThan(1.1);
  expect(st.sim.wSit).toBeCloseTo(st.sim.wEng, 1);
});

test("first press: the causal chain plays and lands the inscription", async ({ page }) => {
  await page.goto("/?fast&seed=7");
  await page.click("#invent");
  await expect(page.locator("#invent")).toBeDisabled();

  const inscription = page.locator(".inscription .line");
  await expect(inscription).toContainText("Nothing happened to babysitting", {
    timeout: 45_000,
  });
  await page.click("#inscription-continue");

  await expect(page.locator("#ledger")).toBeVisible();
  await expect(page.locator("#charts")).toBeVisible();
  await expect(page.locator("#ledger-sit-rate .value")).toContainText("$");

  await expect
    .poll(async () => (await town(page)).d.ratio, { timeout: 30_000 })
    .toBeGreaterThan(1.6);
  const st = await town(page);
  expect(st.phase).toBe("play");
  // The sitter's wage rose even though sitting is unchanged.
  expect(st.sim.wSit).toBeGreaterThan(15);
});

test("full run: six eras, crisis, policies bite", async ({ page, isMobile }) => {
  // Model + narrative logic is viewport-independent; run the long test once.
  test.skip(!!isMobile, "desktop only — logic is viewport-independent");
  // Five sequential long polls; the budget is theirs, not one assertion's.
  test.setTimeout(480_000);
  await page.goto("/?fast&seed=7");

  // the first press is narrated and ends in the first inscription
  await page.click("#invent");
  await dismissInscriptionIfShown(page, 45_000);

  // four more presses reach the last era (2 -> 4 -> 8 -> 16 -> 32)
  for (let i = 0; i < 4; i++) {
    await pressWhenReady(page);
    if (i < 3) await dismissInscriptionIfShown(page, 2_000);
  }

  // the closing inscription is required, not optional — and dismissing it
  // opens the town vote
  await expect(page.locator(".inscription .line")).toContainText(
    "One hour is still one hour",
    { timeout: 90_000 },
  );
  // the ratio has genuinely arrived before the ending is allowed to run
  expect((await town(page)).d.ratio).toBeGreaterThan(20);
  await page.click("#inscription-continue");

  await expect(page.locator("#crisis")).toBeVisible();
  await expect(page.locator("#policy-market")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#invent")).toContainText("maxed out", { timeout: 30_000 });
  await page.click("#time-fast");

  // cap the rate -> sitters leave, coverage collapses
  await page.click("#policy-cap");
  await page.click("#time-fast");
  await expect
    .poll(async () => (await town(page)).d.coverage, { timeout: 60_000 })
    .toBeLessThan(0.75);
  await expect(page.locator("#ledger-coverage .value")).toHaveClass(/alarm/);

  // subsidize -> coverage recovers, the public budget line appears
  await page.click("#policy-subsidy");
  await page.click("#time-fast");
  await expect
    .poll(async () => (await town(page)).d.coverage, { timeout: 60_000 })
    .toBeGreaterThan(0.85);
  await expect
    .poll(async () => (await town(page)).d.publicShare, { timeout: 30_000 })
    .toBeGreaterThan(0.05);

  // robo-sitter -> substitution shows up
  await page.click("#policy-robo");
  await page.click("#time-fast");
  await expect
    .poll(async () => (await town(page)).d.roboShare, { timeout: 60_000 })
    .toBeGreaterThan(0.1);
});

test("charts have table twins with real rows", async ({ page }) => {
  await page.goto("/?fast&seed=7");
  await page.click("#invent");
  const btn = page.locator("#inscription-continue");
  await btn.waitFor({ state: "visible", timeout: 45_000 });
  await btn.click();

  const details = page.locator("#chart-hour details.table-view");
  await details.locator("summary").click();
  const rows = details.locator("tbody tr");
  await expect
    .poll(async () => rows.count(), { timeout: 15_000 })
    .toBeGreaterThan(3);
  await expect(details.locator("thead")).toContainText("1 hour of sitting");
});

test("town hall knobs change the economy", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "desktop only — logic is viewport-independent");
  test.slow();
  await page.goto("/?fast&seed=7");
  await page.click("#invent");
  const btn = page.locator("#inscription-continue");
  await btn.waitFor({ state: "visible", timeout: 45_000 });
  await btn.click();
  // the deeper levers open only after the baseline story concludes
  for (let i = 0; i < 4; i++) {
    await pressWhenReady(page);
    if (i < 3) await dismissInscriptionIfShown(page, 2_000);
  }
  await btn.waitFor({ state: "visible", timeout: 90_000 });
  await btn.click();
  await expect(page.locator("#townhall-wrap")).toBeVisible({ timeout: 30_000 });
  await page.locator("#townhall summary").click();

  // gains to cheaper software: the sitter's DOLLAR rate falls back…
  await page.click("#knob-passthrough-2");
  await page.click("#time-fast");
  const before = (await town(page)).sim.wSit;
  await expect
    .poll(async () => (await town(page)).sim.wSit, { timeout: 60_000 })
    .toBeLessThan(before * 0.7);
  // …but the relative price — the actual disease — survives the costume change.
  const st = await town(page);
  expect(st.d.ratio).toBeGreaterThan(5);
});

test("pausing pauses the story, and reset resets everything", async ({ page }) => {
  await page.goto("/?fast&seed=7");

  // pause, then press: the chain must not narrate a frozen economy
  await page.click("#time-pause");
  await page.click("#invent");
  // the press explicitly unfreezes the town so words and numbers move together
  await expect
    .poll(async () => (await town(page)).sim.wEng, { timeout: 30_000 })
    .toBeGreaterThan(20);
  const btn = page.locator("#inscription-continue");
  await btn.waitFor({ state: "visible", timeout: 45_000 });
  await btn.click();

  // reset: a full reload back to parity, sections re-hidden
  await page.locator("#townhall-wrap").waitFor({ state: "attached" });
  await page.evaluate(() => document.getElementById("reset-town")?.click());
  await page.waitForLoadState("load");
  await expect(page.locator("#ledger")).toBeHidden();
  await expect(page.locator("#invent")).toContainText("Install IDEs");
  const st = await town(page);
  expect(st.pressCount).toBe(0);
  expect(st.sim.wSit).toBeLessThan(13);
});

test("scene pans on a phone and the duel strip keeps both prices visible", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone project only");
  await page.goto("/?fast&seed=7");
  const pan = await page.evaluate(() => {
    const host = document.getElementById("scene-host")!;
    return { scroll: host.scrollWidth, client: host.clientWidth, left: host.scrollLeft };
  });
  expect(pan.scroll).toBeGreaterThan(pan.client);
  expect(pan.left).toBeGreaterThan(0);
  // the whole lesson stays on screen even though the scene pans
  await expect(page.locator("#duel-sit-rate")).toBeVisible();
  await expect(page.locator("#duel-eng-wage")).toBeVisible();
});

test("duel strip stays out of the way on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop project only");
  await page.goto("/?fast&seed=7");
  await expect(page.locator("#duel-sit-rate")).toBeHidden();
});
