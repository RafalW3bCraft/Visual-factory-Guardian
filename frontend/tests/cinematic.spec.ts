import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function seek(page: Page, chapter: number) {
  await page.evaluate(
    (i) =>
      scrollTo(
        0,
        ((document.documentElement.scrollHeight - innerHeight) * i) / 6,
      ),
    chapter,
  );
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-chapter",
    String(chapter),
  );
  await page.waitForTimeout(800);
}
test("persistent scene reverses, reassembles, and works offline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  await canvas.evaluate((el) => el.setAttribute("data-identity", "persistent"));
  await seek(page, 3);
  expect(Number(await canvas.getAttribute("data-explode"))).toBeGreaterThan(
    0.99,
  );
  const middle = await canvas.getAttribute("data-camera");
  await page.context().setOffline(true);
  await seek(page, 6);
  expect(Number(await canvas.getAttribute("data-explode"))).toBe(0);
  await expect(
    page.getByRole("link", { name: "Open Dashboard", exact: true }),
  ).toBeVisible();
  await seek(page, 3);
  expect(await canvas.getAttribute("data-camera")).toBe(middle);
  await seek(page, 0);
  expect(await canvas.getAttribute("data-product-x")).toBe("-4.500");
  expect(await canvas.getAttribute("data-identity")).toBe("persistent");
  expect(errors).toEqual([]);
});
test("all chapters render at judge, tablet and mobile viewports", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [768, 1024],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page
      .getByRole("button", { name: "Pause motion", exact: true })
      .click();
    for (const i of [0, 1, 2, 3, 4, 5, 6]) {
      await seek(page, i);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const panel = page.locator(`.cinema-panel-${i}`);
      await expect(panel).toHaveAttribute("aria-hidden", "false");
      await expect(panel.locator("h1,h2")).toBeInViewport();
      await expect(panel.locator("aside")).toBeInViewport();
      await page.screenshot({
        path: `test-results/cinematic-${width}-${i + 1}.png`,
      });
    }
  }
});
test("keyboard navigation, evidence disclosure and automated accessibility", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  const link = page.getByRole("link", {
    name: "Chapter 6: Investigation",
    exact: true,
  });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("canvas")).toHaveAttribute("data-chapter", "5");
  await page.waitForTimeout(800);
  await page.locator("summary").click();
  await expect(page.locator("details")).toHaveAttribute("open", "");
  await expect(page.locator("details")).toContainText("not an LLM response");
  for (const i of [0, 3, 5, 6]) {
    await seek(page, i);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
test("reduced motion changes safely at a restored scroll position", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await seek(page, 3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Reduced motion" }),
  ).toBeDisabled();
  await expect(page.locator("canvas")).toHaveAttribute("data-chapter", "3");
  await seek(page, 0);
  await expect(page.locator("canvas")).toHaveAttribute("data-explode", "0.000");
});
test("WebGL unavailable preserves the complete textual story and application link", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.includes("webgl")) return null;
      return Reflect.apply(get, this, [kind, ...args]);
    } as typeof get;
  });
  await page.goto("/");
  await expect(
    page.getByText("SIMPLIFIED VIEW · WEBGL UNAVAILABLE"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Chapter 7: The big picture" }).click();
  await expect(
    page.getByRole("link", { name: "Open Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("SIMPLIFIED VISUALIZATION")).toBeVisible();
});
