# Cinematic implementation verification

Executed 16 October 2026 on macOS, Node 25.8.1, npm 11.11.0, installed Google Chrome via Playwright. Base repository commit `bb1e6e2`. Work isolated in a fresh clone because the original Documents workspace returned OS `Operation not permitted`, including an elevated read attempt. Existing local workspace changes could not be inspected and were not touched.

## Commands and actual results

Run from `frontend/`, except where stated:

| Command | Result |
| --- | --- |
| `npm ci` | Success; 229 packages installed. Existing lockfile unchanged. Audit reported three development dependency entries (see below). |
| `npm run build` | Success. Includes `tsc -b`, then Vite production build (2251 modules). |
| `npm test` | 4 files, 22 tests passed. Last run 1.05 seconds. |
| `npm run format:check` | Passed. Repository has no separate lint command. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e` | Final complete run: 13 tests passed in 59.5 seconds. |
| `git diff --check` (repository root) | Passed. |
| `npm audit --json` | Existing Vitest/@vitest/mocker/tinypool development dependency advisories: two critical entries, one moderate; no runtime dependency added. |
| `python3 -m pytest --version` (repository root) | Failed: pytest is not installed in host Python 3.14. Backend tests were not executed; no backend file changed. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/profile-cinematic.mjs` | Executed against production preview; raw final measurements in `CINEMATIC_PROFILE.json`. |

Build warnings: existing Zod PURE annotation comments were removed by Rollup. Build completed successfully. No frontend dependency or lockfile changes.

## Failures resolved during verification

The first full E2E run passed 11/13. The projector test revisited the same fragment URL, which retains the document and its presentation state; an explicit reload now preserves the original fresh-page test setup at each viewport. No assertions were removed. The no-JavaScript test used Playwright text lookup, which intentionally omits noscript; it now verifies the parsed `noscript p` directly. Both focused checks passed, followed by the complete 13/13 run.

## Browser coverage

- Landing widths: 320, 375, 390, 430, 768, 1024, 1440px. All six chapters checked for headings inside the viewport, no horizontal page overflow and no header control overlap.
- Initial opening, machinery, vision, sensor, investigation, final scene and footer visually inspected through screenshots.
- Native navigation, forward and backward chapter progression, reversible inspection overlays, actual fixture values and loaded image dimensions verified.
- No `App-*` or `Factory-*` JavaScript requested on the landing-only journey. No page errors or HTTP failures during that journey.
- Demo entry, evidence interaction, return, browser back/forward and legacy `#experience` deep link verified.
- Original demo scenarios: canvas orbit, equipment focus, replay, backend error recovery, offline scenario, presentation keyboard controls, fullscreen, WebGL fallback and automatic completion all passed.
- Reduced motion, keyboard skip link and static narrative tested at desktop/mobile. Axe WCAG A/AA automated checks returned zero violations in tested landing states and original demo/error states. Automated checks are not a substitute for a full manual assistive-technology audit.
- Forced image failures retain visible fallback, story and functioning demo entry. JavaScript-disabled context still displays the opening photograph and explanatory fallback.

## Performance evidence and limits

Final local lab observation (not field Core Web Vitals):

| Profile | LCP observed | CLS | Scroll p95 / maximum frame interval |
| --- | --- | --- | --- |
| 1440px, unthrottled localhost | 56ms | 0 | 16.8ms / 133.4ms |
| 390px, configured CPU 4× / network 1.6Mbps / latency 80ms | 264ms | 0 | 16.7ms / 16.8ms |

The desktop sample includes one long frame; this is not a claim that every frame is smooth. An earlier desktop sample measured a maximum 16.8ms. Both are short local observations, not a hardware-independent benchmark. Local loading values should not be extrapolated to public network performance; real mobile hardware, deployment caching and Safari/Firefox were not measured.

After forced GC across six demo round trips, JS heap was approximately 7.70, 7.77, 7.84, 7.88, 7.95, 7.94 MB. This modest increase then flattening is evidence from a short session, not proof of absence of all leaks. No forced garbage collection is used in the product.

Initial landing JS is 241.64kB / 75.65kB gzip, CSS 16.52kB / 4.09kB gzip. The demo's 912.45kB Three.js chunk is deferred until demo entry. The six optimized WebP variants total approximately 780KiB on disk; each device requests only its responsive variants. The HTML first frame reserves its image space before JavaScript initializes.

## Artifacts and known limits

Playwright produces `frontend/test-results/film-*.png` (ignored runtime artifacts). Selected screenshots are also saved in the Codex visualization directory for handoff. Asset sources, prompts, formats, exact byte counts and mobile crops are committed in `CINEMATIC_ASSETS.md` and `frontend/public/images/manifest.json`.

No deployment was requested or performed. The local production preview is not a public URL. Real live API/AMD hardware and physical devices were not validated. LLM/manual retrieval is still planned. Existing development dependency updates require a separate major Vitest upgrade; this task did not silently apply `npm audit fix --force`.
