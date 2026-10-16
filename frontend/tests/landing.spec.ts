import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const chapters = [
  "factory",
  "signals",
  "vision",
  "context",
  "understanding",
  "next",
];

test("photographic story loads, reverses and navigates without loading WebGL", async ({
  page,
}) => {
  const errors: string[] = [],
    failed: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The factorynever stops.",
  );
  await expect(page.locator(".film-hero img")).toBeVisible();
  for (const id of chapters) {
    await page.locator(`[data-chapter-link][href="#${id}"]`).click();
    await expect(
      page.locator(`[data-chapter-link][href="#${id}"]`),
    ).toHaveAttribute("aria-current", "step");
    await expect(page.locator(`#${id} h1, #${id} h2`)).toBeInViewport();
    await page.screenshot({ path: `test-results/film-desktop-${id}.png` });
  }
  await page
    .getByRole("link", { name: "Explore the technology", exact: true })
    .click();
  await expect(page.locator('[data-chapter-link="2"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.locator('[data-chapter-link="1"]').click();
  await expect
    .poll(() =>
      page
        .locator(".film-focus-frame")
        .evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(0);
  await page.locator('[data-chapter-link="3"]').click();
  await expect
    .poll(() =>
      page
        .locator(".film-sensor-labels")
        .evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);
  await expect(page.locator(".film-readings")).toContainText("82.49");
  await expect(page.locator(".film-readings")).toContainText("2.62");
  expect(
    await page
      .locator(".film-photograph:visible img")
      .evaluateAll((images) =>
        images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBe(true);
  expect(requests.filter((url) => /\/Factory-|\/App-/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test("all requested widths retain readable chapters and unobstructed controls", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const id of chapters) {
      await page.evaluate(
        (id) => document.getElementById(id)?.scrollIntoView(),
        id,
      );
      await expect(page.locator(`#${id} h1, #${id} h2`)).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const heading = await page.locator(`#${id} h1, #${id} h2`).boundingBox();
      expect(heading!.x).toBeGreaterThanOrEqual(0);
      expect(heading!.x + heading!.width).toBeLessThanOrEqual(width);
    }
    const brand = await page.locator(".film-brand").boundingBox(),
      demo = await page.locator(".film-demo-link").boundingBox();
    expect(brand!.x + brand!.width).toBeLessThan(demo!.x);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/film-responsive-${width}.png`,
      fullPage: true,
    });
  }
});

test("reduced motion, keyboard anchors and WCAG A/AA", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to the experience" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#signals h2")).toBeInViewport();
    expect(
      await page
        .locator(".film-camera")
        .evaluate((el) => getComputedStyle(el).transform),
    ).toBe("none");
    for (const id of ["factory", "context", "understanding", "next"]) {
      await page.evaluate(
        (id) => document.getElementById(id)?.scrollIntoView(),
        id,
      );
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
    await page.screenshot({
      path: `test-results/film-reduced-${width}.png`,
      fullPage: true,
    });
  }
});

test("demo entry, browser history and return retain the original workspace", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open demo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip to evidence" }).click();
  await expect(page.getByText("Thermal process instability")).toBeVisible();
  await page.getByRole("link", { name: "Return to the factory story" }).click();
  await expect(page.locator("#factory h1")).toBeInViewport();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.locator("#factory h1")).toBeInViewport();
  await page.screenshot({ path: "test-results/film-after-demo.png" });
  await page.goto("/#experience");
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
});

test("image failures preserve narrative and a working demo link", async ({
  page,
}) => {
  await page.route("**/images/*.webp", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".film-hero .film-media-fallback")).toBeVisible();
  await expect(page.locator("h1")).toBeVisible();
  await page.getByRole("link", { name: "Open demo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
});

test("the first photograph is available without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator(".initial-scene img")).toBeVisible();
  // Text selectors intentionally exclude noscript; inspect the parsed fallback directly.
  await expect(page.locator("noscript p")).toBeVisible();
  await expect(page.locator("noscript p")).toContainText(
    "Enable JavaScript to explore",
  );
  expect(
    await page.locator(".initial-scene img").getAttribute("fetchpriority"),
  ).toBe("high");
  await context.close();
});
