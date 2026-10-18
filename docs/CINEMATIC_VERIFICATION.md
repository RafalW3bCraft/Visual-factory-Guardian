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
# Cinematic landing — implementation and verification

## Scope and provenance

Implemented on `codex/cinematic-factory-story`, based on main `bb1e6e2`. The existing operator application is now at `/dashboard`; `/` introduces it through seven scroll-controlled chapters. No backend, vision, telemetry or existing application component was rewritten.

The supplied 11.133-second coffee-product recording was inspected at half-second intervals before implementation. The new work transfers its warm editorial canvas, dominant physical subject and continuous transitions. It contains no reference-video frames or copied branding/assets. See [the design contract](CINEMATIC_DESIGN.md).

The narrative follows P-004 / evt-004 from the existing frontend's `thermal-drift-001` fixture. Temperature drift begins at 18 seconds and the inspection occurs at 32 seconds. The visual crack and localization indicator are original conceptual geometry, not an ML localization output. Telemetry is explicitly simulated. The explanation is deterministic, proposes a candidate factor and alternative, and includes no invented citation or confidence percentage. AMD adapter code exists; AMD inference performance has not been verified by this landing-page work.

## Architecture

- `src/cinematic/director.ts`: pure camera/target and mechanical state sampling from normalized progress. Smooth held compositions interpolate in both directions. Portrait uses a bounded assembly framing; reduced motion uses chapter camera cuts.
- `Landing.tsx`: one cleaned-up GSAP ScrollTrigger, seven semantic chapters, projected editorial layers, fixture-based SVG traces, evidence timeline, native uncertainty disclosure, chapter anchors and explicit simulation labeling. Inactive chapters are inert and hidden from assistive technology.
- `Stage.tsx`: persistent lazy-loaded R3F Canvas, local studio environment, lighting, camera director, WebGL/context-loss fallback and rendering instrumentation. Hidden tabs, reduced motion and the pause control use demand rendering.
- `Machinery.tsx`: original machined flange, inspection camera/ring light, conveyor rollers/fasteners, removable service panels, thermal coil, motor fins, sensors, control cabinet and foundation. Repeated rollers/bolts are instanced. Locally generated roller texture and shared signal material are disposed on unmount.
- Existing dashboard CSS and modules load only on the dashboard route. Both routes use the existing static-host SPA rewrite.
- All landing assets, including licensed fonts, are bundled locally. After initial loading, the story can complete offline. There is no offline-first installer or service worker.

## Executed validation

Environment: macOS arm64, Node 25.8.1, Chrome 155.0.8059.82, Apple M4 Pro / ANGLE Metal. Mobile sizes below are desktop browser viewport emulations, not physical phone measurements.

- `npm run build`: TypeScript and production Vite build passed.
- `npm test`: 25 tests passed, including existing app/API/scenario tests and three director tests for continuity, reversibility and bounded inputs.
- `npm run format:check`: passed.
- Full Playwright suite: 12 tests passed. After final trace-reveal, reduced-motion, font and skip-link refinements, all five cinematic browser tests were rerun and passed. Includes all existing dashboard tests, presentation/fullscreen, replay, API failure handling and accessibility checks.
- Cinematic tests cover one-Canvas identity, forward/reverse equality, assembly reset, offline story completion, keyboard chapter navigation, evidence disclosure, reduced-motion preference changes, WebGL-disabled fallback and the dashboard link.
- Seven chapters captured at 1920×1080, 1440×900, 1366×768, 768×1024, 390×844 and 320×740. No horizontal page overflow at these sizes. Desktop/tablet/mobile screenshots were visually inspected and framing corrected.
- Automated axe WCAG A/AA checks passed at reveal, telemetry, investigation and conclusion. These checks do not establish full accessibility conformance or substitute for manual assistive-technology testing.

Commands from `frontend/`:

```sh
npm ci
npm run build
npm test
npm run format:check
# Install Playwright Chromium or set PLAYWRIGHT_CHROMIUM_EXECUTABLE.
npm run test:e2e
```

## Rendering measurements

Raw results are in [CINEMATIC_PERFORMANCE.json](CINEMATIC_PERFORMANCE.json). The script measures actual R3F frame-counter advancement while scrolling the entire story over six seconds, plus browser animation-frame intervals. Warm-up is 1.5 seconds. One run per viewport; no concurrent browser test suite. Draw-call and triangle figures are the maximum observed sampled Three.js render counters, not GPU profiler measurements. Environment-map passes can temporarily reset those counters.

| Viewport | Rendered cadence | Browser frame interval p95 | Peak sampled draws / triangles |
|---|---:|---:|---:|
| 1440×900 | 60.1 frames/s | 16.7 ms | 186 / 48,058 |
| 390×844 (same desktop GPU) | 60.0 frames/s | 16.7 ms | 186 / 48,058 |

To reproduce, start `npm run preview -- --port 4173` in one terminal, then run `node scripts/measure-cinematic.mjs` in another. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using an installed Chrome binary and `VFG_PREVIEW_URL` to change the target. The results apply to this machine and short test, not every device or a long-duration soak test.

## Screenshots

![Reveal at 1440×900](images/cinematic-reveal.png)
![Exploded thermal cell at 1440×900](images/cinematic-thermal.png)
![Investigation at 390×844](images/cinematic-mobile.png)

## Limits and publication

- No Safari/Firefox or physical phone validation was performed.
- The existing dependency audit reports three development-tool advisories involving Vitest, its mocker and Tinypool. The new runtime packages were not listed. A Vitest major upgrade is outside this landing-page change; do not expose its development server publicly.
- Vite emits existing Zod PURE-comment warnings but completes successfully.
- Backend modules were preserved and their tests were not rerun for this frontend-only change. No live backend integration is claimed for the landing.
- Public hosting is separate from publishing a Git branch/PR. A local preview URL is not a public deployment. This change does not merge main or assert a successful hosting deployment.
