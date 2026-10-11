import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test("the essay loads with every figure and no errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/?silent&fast");
  await expect(page).toHaveTitle("One Hour Is Still One Hour");
  for (const name of ["hero", "hats", "minutes", "morph", "bridge", "basket", "choices", "demand", "afford", "cases", "lab"]) {
    const fig = page.locator(`[data-figure="${name}"]`);
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator("svg").first()).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("three inventions make a haircut cost eight hats", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="hats"]');
  await fig.scrollIntoViewIfNeeded();
  const invent = fig.getByRole("button", { name: /Invent a better machine/ });
  for (let i = 1; i <= 3; i++) {
    await invent.click();
    await expect(invent).toHaveAttribute("aria-label", `Invent a better machine (${i} of 5 so far)`);
    await expect(fig.locator(".ledger__row")).toHaveCount(i + 1, { timeout: 40_000 });
  }
  await expect(fig.locator(".story__text")).toHaveText("The barbers are back. A haircut now costs 8 hats. It still takes thirty minutes.");
  await expect(fig.locator(".ledger__row").last().locator("td").last()).toHaveText("8");
});

test("re-skinning the town leaves the chart alone", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="morph"]');
  await fig.scrollIntoViewIfNeeded();
  const line = fig.locator(".xy__line");
  const before = await line.getAttribute("d");
  await fig.getByRole("radio", { name: "Things & care" }).click();
  await expect(fig.locator(".chart-title")).toHaveText("Price of one care-hour, in gadgets");
  expect(await line.getAttribute("d")).toBe(before);
});

test("a wage cap shows up as a worse report card", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="choices"]');
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".report tbody tr")).toHaveCount(1, { timeout: 20_000 });
  await fig.getByRole("radio", { name: /Cap wages and prices/ }).click();
  await expect(fig.locator(".report tbody tr")).toHaveCount(2, { timeout: 20_000 });
  await expect(fig.locator(".report tbody tr").nth(1).locator("td.is-worse").first()).toBeVisible();
});

test("closing the road keeps care cheap", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="bridge"]');
  await fig.scrollIntoViewIfNeeded();
  await fig.getByRole("switch", { name: "Caregivers can take factory jobs" }).click();
  await fig.getByRole("button", { name: /Invent a better machine/ }).click();
  await fig.getByRole("button", { name: /Invent a better machine/ }).click();
  await expect(fig.locator(".verdict")).toContainText("can't leave", { timeout: 15_000 });
  await expect(fig.locator(".stat.tone-coin .stat__value")).toHaveText("1 gadget");
});

test("lab settings travel in the link", async ({ page }) => {
  await page.goto("/?silent&fast#lab?s=lessons&caseload=2");
  const fig = page.locator('[data-figure="lab"]');
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.getByRole("radio", { name: "Education" })).toHaveAttribute("aria-checked", "true");
  await expect(fig.locator(".lab__note-title")).toHaveText("Education: Bread and Lessons");
  await fig.getByRole("button", { name: "Play" }).click();
  await expect(fig.locator(".transport__year")).not.toHaveText("Year 0 of 40", { timeout: 10_000 });
});

test("the lab plays a full run and can run again", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="lab"]');
  await fig.scrollIntoViewIfNeeded();
  await fig.getByRole("radio", { name: "4×" }).click();
  await fig.getByRole("button", { name: "Play" }).click();
  await expect(fig.locator(".transport__year")).toHaveText("Year 40 of 40 · done", { timeout: 30_000 });
  await fig.getByRole("button", { name: "Run again" }).click();
  await expect(fig.locator(".transport__year")).not.toHaveText("Year 40 of 40 · done", { timeout: 5_000 });
  await expect(fig.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("the morph can go from any chip straight back to hats", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="morph"]');
  await fig.scrollIntoViewIfNeeded();
  await fig.getByRole("radio", { name: "Education" }).click();
  await expect(fig.locator(".chart-title")).toHaveText("Price of one student-hour, in loaves");
  await expect(fig.getByRole("radio", { name: "Hats & haircuts" })).toHaveAttribute("aria-checked", "false");
  await fig.getByRole("radio", { name: "Hats & haircuts" }).click();
  await expect(fig.locator(".chart-title")).toHaveText("Price of one haircut, in hats");
});

test("the minutes equation stays exact at every step", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="minutes"]');
  await fig.scrollIntoViewIfNeeded();
  await fig.getByRole("radio", { name: "4" }).click();
  const timeFraction = fig.locator(".eq__frac").nth(1);
  await expect(timeFraction).toContainText("1800");
  await expect(timeFraction).toContainText("112½");
});

test("the casebook shows each industry's evidence and opens it in the lab", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="cases"]');
  await fig.scrollIntoViewIfNeeded();
  await expect(fig.locator(".case__title")).toHaveText("Live performance: Copies and Concerts");
  await fig.getByRole("radio", { name: "Home repair" }).click();
  await expect(fig.locator(".case__title")).toHaveText("Home repair: Fixtures and Tradespeople");
  await expect(fig.locator(".case__sources a").first()).toHaveAttribute("href", "https://www.nber.org/papers/w30845");
  await fig.getByRole("link", { name: /Open this industry in the lab/ }).click();
  const lab = page.locator('[data-figure="lab"]');
  await expect(lab.locator(".lab__note-title")).toHaveText("Home repair: Fixtures and Tradespeople", { timeout: 10_000 });
});

test("opening the same industry again restarts the lab with the case's settings", async ({ page }) => {
  await page.goto("/?silent&fast");
  const fig = page.locator('[data-figure="cases"]');
  const lab = page.locator('[data-figure="lab"]');
  await fig.scrollIntoViewIfNeeded();
  await fig.getByRole("radio", { name: "Education" }).click();
  const open = fig.getByRole("link", { name: /Open this industry in the lab/ });
  await open.click();
  await expect(lab.locator(".lab__note-title")).toHaveText(/^Education:/, { timeout: 10_000 });
  await expect(page).toHaveURL(/#lab\?/);

  // Run it a while, nudge a control, then come back for the same case.
  await lab.getByRole("button", { name: "Play" }).click();
  await expect(lab.locator(".transport__year")).not.toHaveText(/^Year 0\b/, { timeout: 10_000 });
  await lab.getByRole("button", { name: "Pause" }).click();
  await fig.scrollIntoViewIfNeeded();
  await open.click();
  await expect(lab.locator(".transport__year")).toHaveText(/^Year 0\b/);
  await expect(lab.getByRole("button", { name: "Play" })).toBeVisible();
});
