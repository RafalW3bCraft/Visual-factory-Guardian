import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const seek = async (page: Page, t: number) => {
  await page.evaluate(
    (t) =>
      window.scrollTo(
        0,
        Math.ceil(
          (t / 56) *
            (document.getElementById("factory")!.offsetHeight - innerHeight),
        ),
      ),
    t,
  );
  await expect
    .poll(async () =>
      Number(await page.locator(".ex-viewport").getAttribute("data-time")),
    )
    .toBeGreaterThanOrEqual(t);
  await page.waitForTimeout(160);
};
test("scroll controls a reversible articulated cell, pauses and exposes spatial evidence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(350);
  const initial = await page.locator("canvas").screenshot();
  for (const t of [7, 11, 16, 28, 33, 38, 48, 54]) {
    await seek(page, t);
    await page.screenshot({ path: `test-results/simulation-${t}.png` });
  }
  await seek(page, 11);
  const pose = await page.locator(".ex-viewport").getAttribute("data-pose");
  const before = await page.locator("canvas").screenshot();
  expect(before.equals(initial)).toBe(false);
  await page.waitForTimeout(450);
  expect(await page.locator(".ex-viewport").getAttribute("data-pose")).toBe(
    pose,
  );
  expect((await page.locator("canvas").screenshot()).equals(before)).toBe(true);
  await seek(page, 33);
  await expect(page.locator(".cell-projected.flagged")).toBeVisible();
  const label = (await page.locator(".cell-projected.flagged").boundingBox())!,
    canvas = (await page.locator("canvas").boundingBox())!;
  expect(label.x).toBeGreaterThan(canvas.x);
  expect(label.x + label.width).toBeLessThan(canvas.x + canvas.width);
  await page.getByRole("button", { name: "Inspect affected surface" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "2026-10-15T10:00:32.000Z",
  );
  await page.getByRole("button", { name: "Magnify defect" }).click();
  await expect(
    page.getByRole("button", { name: "Full component" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/simulation-evidence.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await seek(page, 11);
  expect(await page.locator(".ex-viewport").getAttribute("data-pose")).toBe(
    pose,
  );
  expect((await page.locator("canvas").screenshot()).equals(before)).toBe(true);
  await seek(page, 54);
  await page.getByRole("link", { name: "Enter interactive demo" }).click();
  await expect(page.getByRole("slider", { name: "Scenario time" })).toHaveValue(
    "54",
  );
  await page.getByRole("link", { name: "Factory story", exact: true }).click();
  await expect(page.locator(".ex-viewport")).toHaveAttribute("data-stage", "0");
  expect(errors).toEqual([]);
});
test("operator can inspect equipment, investigate, record all decisions and restart", async ({
  page,
}) => {
  await page.goto("/#/demo");
  await page
    .getByRole("button", { name: "Start scenario", exact: true })
    .click();
  await expect.poll(() => page.getByRole("slider").inputValue()).not.toBe("0");
  await page.getByRole("button", { name: "Pause scenario" }).click();
  const paused = await page.getByRole("slider").inputValue();
  await page.waitForTimeout(250);
  expect(await page.getByRole("slider").inputValue()).toBe(paused);
  await page.getByRole("button", { name: "Resume scenario" }).click();
  await expect
    .poll(() => page.getByRole("slider").inputValue())
    .not.toBe(paused);
  await page.getByRole("button", { name: "Pause scenario" }).click();
  const tabs = page.getByRole("navigation", {
    name: "Investigation workspace",
  });
  await tabs.getByRole("button", { name: "Equipment", exact: true }).click();
  await page.getByRole("button", { name: "Drive motor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Conveyor drive" }),
  ).toBeVisible();
  await page.getByLabel("Sensor metric").selectOption("vibration");
  await expect(page.locator(".ex-reading")).toContainText("mm/s");
  await tabs.getByRole("button", { name: "Inspection", exact: true }).click();
  await page
    .getByRole("button", { name: "Advance to captured observation" })
    .click();
  await page.getByRole("button", { name: "Open detected region" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Hide region" }).click();
  await expect(
    page.getByRole("button", { name: "Show region" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Close evidence" }).click();
  await tabs.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByRole("button", { name: /○ P-001/ }).click();
  await expect(page.getByRole("dialog")).toContainText("0.12");
  await page.keyboard.press("Escape");
  await tabs
    .getByRole("button", { name: "Investigation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Assemble evidence at T+44s" })
    .click();
  await page.getByText("Possible explanation", { exact: true }).click();
  await expect(
    page.getByText(/Thermal process instability is a candidate/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to operator review" })
    .click();
  for (const [button, note] of [
    ["Confirm finding", "Inspect surface under magnification"],
    ["Reject finding", "Fixture may be a handling mark"],
    ["Request additional inspection", "Compare adjacent components"],
  ]) {
    await page.getByLabel("Engineering note (optional)").fill(note);
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      page.getByRole("status", { name: "Operator review outcome" }),
    ).toContainText(note);
  }
  await page.screenshot({ path: "test-results/simulation-demo-review.png" });
  await page.getByRole("button", { name: "View recorded outcome →" }).click();
  await expect(page.locator(".ex-history")).toContainText(
    "Operator: confirmed",
  );
  await expect(page.locator(".ex-history")).toContainText("Operator: rejected");
  await expect(page.locator(".ex-history")).toContainText(
    "Operator: reinspect",
  );
  await page.getByRole("button", { name: "Restart scenario" }).click();
  await expect(page.getByRole("slider")).toHaveValue("0");
  await tabs.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".ex-history")).not.toContainText("Operator:");
});
test("desktop and mobile layouts, keyboard step alternative and accessibility", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to timeline controls" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "5. Potential anomaly", exact: true })
      .click();
    await expect(page.locator(".ex-viewport")).toHaveAttribute(
      "data-time",
      "32.000",
    );
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
      path: `test-results/simulation-mobile-${width}.png`,
    });
    await page.getByRole("link", { name: "Open demo", exact: true }).click();
    await expect(page.getByRole("slider")).toHaveValue("32");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("navigation", { name: "Investigation workspace" })
      .getByRole("button", { name: "Review", exact: true })
      .click();
    await page.getByRole("button", { name: "Prepare review at T+50s" }).click();
    await page
      .getByRole("button", { name: "Confirm finding", exact: true })
      .click();
    await expect(
      page.getByRole("status", { name: "Operator review outcome" }),
    ).toContainText("Finding confirmed");
    const demo = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      demo.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/simulation-demo-${width}.png`,
      fullPage: true,
    });
  }
});
test("no WebGL keeps the complete evidence and review workflow", async ({
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
  await page.goto("/#/demo?t=50");
  await expect(page.getByText(/SIMPLIFIED PROCESS VIEW/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Investigation workspace" })
    .getByRole("button", { name: "Review", exact: true })
    .click();
  await page.getByRole("button", { name: "Review visual evidence" }).click();
  await expect(page.getByRole("dialog")).toContainText("P-004");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Reject finding", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Operator review outcome" }),
  ).toContainText("Finding rejected");
});
test("existing console and browser navigation remain available", async ({
  page,
}) => {
  await page.goto("/#/demo");
  await page
    .getByRole("link", { name: "Existing simulation & backend console" })
    .click();
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "From observation to decision." }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("button", { name: "Presentation mode" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to the factory story" }).click();
  await expect(page.locator(".ex-story")).toBeVisible();
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
