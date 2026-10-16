import { test, expect } from "@playwright/test";
test("factory, camera, evidence, replay and backend recovery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/demo");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Focus Vision station" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause scenario" }).click();
  const paused = await page.getByRole("slider").inputValue();
  await page.waitForTimeout(350);
  expect(await page.getByRole("slider").inputValue()).toBe(paused);
  await page.getByRole("button", { name: "Play scenario" }).click();
  await expect
    .poll(() => page.getByRole("slider").inputValue())
    .not.toBe(paused);
  await page.getByRole("button", { name: "Pause scenario" }).click();
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.65, {
    steps: 10,
  });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.getByRole("button", { name: "Focus Vision station" }).click();
  await expect(
    page.getByRole("heading", { name: "Inspection evidence" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Flagged · P-004/ }).click();
  await expect(page.getByText("0.87", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip to evidence" }).click();
  await expect(page.getByText("Thermal process instability")).toBeVisible();
  await page.getByRole("button", { name: "Next scene" }).click();
  await page
    .getByRole("button", { name: "Mark demo inspection reviewed" })
    .click();
  await expect(
    page.getByRole("button", { name: "Demo review recorded" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Backend not verified/ }).click();
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByRole("alert")).toContainText("not configured");
  await expect(
    page.getByRole("button", { name: "Start live scenario" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Return to Guided Simulation" })
    .click();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Restart demo" }).click();
  await page
    .getByRole("button", { name: "Launch investigation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause scenario" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip to evidence" }).click();
  await expect(page.getByText("Thermal process instability")).toBeVisible();
  expect(errors).toEqual([]);
});
test("presentation, reduced motion and visual scenes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/demo");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play scenario" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/hero.png", fullPage: true });
  await page.getByRole("button", { name: "Presentation mode" }).click();
  await page.locator("h1").click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("h1")).toHaveText(
    "A defect is only the beginning.",
  );
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Pause scenario" }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("r");
  await expect(page.getByRole("slider")).toHaveValue("8");
  for (const [scene, name] of [
    [0, "overview"],
    [2, "vision"],
    [3, "telemetry"],
    [5, "investigation"],
    [7, "amd"],
    [8, "final"],
  ] as const) {
    await page
      .getByRole("navigation", { name: "Story scenes" })
      .getByRole("button")
      .nth(scene)
      .click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
  }
  await page.locator("h1").click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
});
test("responsive stage has no horizontal page overflow", async ({ page }) => {
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [768, 1024],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/#/demo");
    await expect(page.locator("canvas")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/responsive-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Inspect Temperature" }).click();
    await expect(
      page.getByRole("heading", { name: "Signals in context" }),
    ).toBeVisible();
  }
});
test("WebGL unavailable retains all investigation controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (
        kind === "webgl" ||
        kind === "webgl2" ||
        kind === "experimental-webgl"
      )
        return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/#/demo");
  await expect(page.getByText("SIMPLIFIED VISUALIZATION")).toBeVisible();
  await page.getByRole("button", { name: "Skip to evidence" }).click();
  await expect(page.getByText("Thermal process instability")).toBeVisible();
});

test("presentation fits projector viewports and exposes fullscreen control", async ({
  page,
}) => {
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/#/demo");
    // Navigating to the same fragment keeps the existing document and its state.
    await page.reload();
    await page.getByRole("button", { name: "Presentation mode" }).click();
    await page
      .getByRole("navigation", { name: "Story scenes" })
      .getByRole("button")
      .nth(3)
      .click();
    await expect(
      page.getByRole("button", { name: "Next scene" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 2,
      ),
    ).toBe(true);
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `test-results/presentation-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Toggle fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.keyboard.press("Escape");
});

test("automatic playback completes and replays without fatal console errors", async ({
  page,
}) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/#/demo");
  await page
    .getByRole("button", { name: "Launch investigation", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("2");
  await expect(
    page.getByRole("heading", { name: "Operator decision" }),
  ).toBeVisible({ timeout: 32000 });
  await page
    .getByRole("button", { name: "Mark demo inspection reviewed" })
    .click();
  await page.getByRole("button", { name: "Restart demo" }).click();
  await expect(page.getByRole("slider")).toHaveValue("0");
  expect(errors).toEqual([]);
});
