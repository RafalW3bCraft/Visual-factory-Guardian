import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("WCAG A/AA automated checks for overview, evidence and backend error", async ({
  page,
}) => {
  await page.goto("/#/demo");
  await page.getByRole("button", { name: "Pause scenario" }).click();
  for (const scene of [0, 5]) {
    await page
      .getByRole("navigation", { name: "Story scenes" })
      .getByRole("button")
      .nth(scene)
      .click();
    await page.waitForTimeout(300);
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
  await page.getByRole("button", { name: /Backend not verified/ }).click();
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
