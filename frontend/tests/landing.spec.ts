import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const seek = async (page: Page, chapter: number) => {
  await page.evaluate(
    (chapter) =>
      window.scrollTo(
        0,
        (chapter / 6) *
          (document.querySelector<HTMLElement>(".cinema-track")!.offsetHeight -
            innerHeight),
      ),
    chapter,
  );
  await expect
    .poll(async () =>
      Number(await page.locator(".cinema").getAttribute("data-progress")),
    )
    .toBeCloseTo(chapter / 6, 3);
  await expect(page.locator(".cinema-panel").nth(chapter)).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await page.waitForTimeout(250);
};
test("seven chapters reverse camera, product and exploded assembly; motion can pause", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-chapter", "0");
  await page.getByRole("button", { name: "Pause motion" }).click();
  await seek(page, 1);
  const camera = await canvas.getAttribute("data-camera"),
    product = await canvas.getAttribute("data-product-x");
  for (const chapter of [2, 3, 4, 5, 6]) {
    await seek(page, chapter);
    if (chapter === 3) {
      await expect(canvas).toHaveAttribute("data-explode", "1.000");
      await expect(page.locator(".cinema")).toHaveAttribute(
        "data-tone",
        "dark",
      );
    }
    await page.screenshot({
      path: `test-results/refined-chapter-${chapter}.png`,
    });
  }
  await expect(canvas).toHaveAttribute("data-explode", "0.000");
  await seek(page, 1);
  await expect(canvas).toHaveAttribute("data-camera", camera!);
  await expect(canvas).toHaveAttribute("data-product-x", product!);
  await page.waitForTimeout(400);
  const frame = await canvas.getAttribute("data-frames");
  await page.waitForTimeout(350);
  expect(await canvas.getAttribute("data-frames")).toBe(frame);
  await page.getByRole("button", { name: "Resume motion" }).click();
  await expect.poll(() => canvas.getAttribute("data-frames")).not.toBe(frame);
  await seek(page, 0);
  await page.screenshot({ path: "test-results/refined-desktop.png" });
  expect(errors).toEqual([]);
});
test("story, demo, legacy dashboard and browser navigation keep their colors and controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Demo mode" }).click();
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(8, 11, 16)",
  );
  await page.getByRole("button", { name: "Skip to evidence" }).click();
  await expect(page.getByText("Thermal process instability")).toBeVisible();
  await page.getByRole("link", { name: "Return to the factory story" }).click();
  await expect(page.locator(".cinema-panel-0 h1")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(240, 238, 232)",
  );
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to the factory story" }).click();
  await expect(page.locator(".cinema-panel-0 h1")).toBeVisible();
});
test("keyboard chapters and reduced-motion desktop/mobile layouts remain accessible", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Reduced motion" }),
    ).toBeDisabled();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to story" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    for (const chapter of [0, 3, 5, 6]) {
      await seek(page, chapter);
      const panel = page.locator(".cinema-panel").nth(chapter);
      await expect(panel.locator(".cinema-copy")).toBeInViewport();
      await expect(panel.locator(".cinema-annotation")).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/refined-${width}-${chapter}.png`,
      });
    }
    await page.getByRole("link", { name: "Chapter 2: The product" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".cinema-panel-1")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  }
});
test("WebGL fallback preserves story, disclosure and demo investigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.startsWith("webgl")) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(
    page.getByText("SIMPLIFIED VIEW · WEBGL UNAVAILABLE"),
  ).toBeVisible();
  await seek(page, 5);
  await page.getByText("Evidence & uncertainty").click();
  await expect(page.locator("details[open]")).toContainText(
    "not an LLM response",
  );
  await page.getByRole("link", { name: "Demo mode" }).click();
  await expect(page.getByText("SIMPLIFIED VISUALIZATION")).toBeVisible();
  await page.getByRole("button", { name: "Skip to evidence" }).click();
  await expect(page.getByText("Thermal process instability")).toBeVisible();
});
test("no-JavaScript fallback describes process and provenance", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator(".initial-scene h1")).toBeVisible();
  await expect(page.locator("noscript p")).toContainText(
    "No live hardware or inference is claimed.",
  );
  await context.close();
});
