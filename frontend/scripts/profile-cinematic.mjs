// Local lab check, not field Core Web Vitals. Run against npm run preview.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const reports = [];
for (const mobile of [false, true]) {
  const page = await browser.newPage({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const cdp = await page.context().newCDPSession(page);
  if (mobile) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 80,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
  await page.addInitScript(() => {
    window.__lab = { lcp: 0, cls: 0, longTasks: [] };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lab.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput) window.__lab.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__lab.longTasks.push(e.duration);
    }).observe({ type: "longtask", buffered: true });
  });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const load = await page.evaluate(() => ({
    ...window.__lab,
    resources: performance
      .getEntriesByType("resource")
      .map((r) => ({ name: r.name.split("/").pop(), bytes: r.transferSize })),
  }));
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        let previous = performance.now(),
          start = previous;
        const tick = (now) => {
          frames.push(now - previous);
          previous = now;
          const p = Math.min(1, (now - start) / 2500);
          window.scrollTo(
            0,
            (document.documentElement.scrollHeight - innerHeight) * p,
          );
          if (p < 1) requestAnimationFrame(tick);
          else resolve(frames.slice(1));
        };
        requestAnimationFrame(tick);
      }),
  );
  frames.sort((a, b) => a - b);
  const heaps = [];
  if (!mobile) {
    for (let i = 0; i < 6; i++) {
      await page.locator(".film-demo-link").click();
      await page.getByRole("button", { name: "Presentation mode" }).waitFor();
      await page
        .getByRole("link", { name: "Return to the factory story" })
        .click();
      await page.locator("#factory h1").waitFor();
      await page.waitForTimeout(200);
      await cdp.send("HeapProfiler.collectGarbage");
      heaps.push((await cdp.send("Runtime.getHeapUsage")).usedSize);
    }
  }
  reports.push({
    profile: mobile
      ? "390px / CPU 4x / 1.6Mbps / 80ms RTT"
      : "1440px / unthrottled localhost",
    load,
    scroll: {
      frames: frames.length,
      p95_ms: frames[Math.floor(frames.length * 0.95)],
      max_ms: Math.max(...frames),
    },
    heapBytesAfterDemoRoundTrips: heaps,
  });
  await page.close();
}
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/cinematic-profile.json",
  JSON.stringify(reports, null, 2),
);
console.log(JSON.stringify(reports, null, 2));
await browser.close();
