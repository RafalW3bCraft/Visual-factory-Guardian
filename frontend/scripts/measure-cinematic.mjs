import { chromium } from "@playwright/test";
// Run against a separately started production preview. Do not run concurrently
// with other browser suites: contention invalidates the measurement.
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const reports = [];
for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(process.env.VFG_PREVIEW_URL || "http://127.0.0.1:4173/");
  await page.locator("canvas[data-frames]").waitFor();
  await page.waitForTimeout(1500);
  const result = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    const before = Number(canvas.dataset.frames);
    const intervals = [],
      calls = [],
      triangles = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      function frame(now) {
        intervals.push(now - last);
        calls.push(Number(canvas.dataset.drawCalls || 0));
        triangles.push(Number(canvas.dataset.triangles || 0));
        last = now;
        scrollTo(
          0,
          Math.min(1, (now - start) / 6000) *
            (document.documentElement.scrollHeight - innerHeight),
        );
        if (now - start < 6000) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    const elapsed = performance.now() - start;
    const sorted = intervals.slice(2).sort((a, b) => a - b);
    const gl = canvas.getContext("webgl2");
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      elapsedMs: Math.round(elapsed),
      renderedFrames: Number(canvas.dataset.frames) - before,
      renderedFps: +(
        ((Number(canvas.dataset.frames) - before) * 1000) /
        elapsed
      ).toFixed(1),
      rafMedianMs: +sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
      rafP95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      renderer: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : "unavailable",
      peakObservedDrawCalls: Math.max(...calls),
      peakObservedTriangles: Math.max(...triangles),
      userAgent: navigator.userAgent,
    };
  });
  reports.push({ width, height, ...result });
  await page.close();
}
console.log(
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      browser: browser.version(),
      reports,
    },
    null,
    2,
  ),
);
await browser.close();
