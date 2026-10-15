# Frontend verification report — 15 October 2026

## Environment
- macOS 26.6.2 (25G83), Node 25.8.1, npm 11.11.0.
- Headless Google Chrome 155.0.8059.41; WebGL renderer: ANGLE Metal / Apple M4 Pro. Browser reports 14 hardware threads and device pixel ratio 1.
- Local Vite production preview, no network throttling. No AMD runtime or inference hardware was exercised.

## Executed checks
| Command | Result |
|---|---|
| `npm test` | 22 tests pass: deterministic reducer/timing, event/product association, signal baselines, evidence windows, API validation/errors/timeout, live session integration using mocked HTTP, navigation, review, presentation, sensor selection and selected-event preservation. |
| `npm run build` | Strict TypeScript and production build pass. |
| `npm run format:check` | Pass. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e` | 7 tests pass against the production build; 45.4 seconds for the complete suite before the final event-selection correction. The affected workflow test was rerun after that correction. |
| `git diff --check` | Pass. |

Browser coverage: initial canvas; camera orbit/reset; equipment hotspot; normal/flagged selection; pause/resume; evidence and review; reset/replay; disconnected-network continuation after loading; unavailable backend; reduced motion; manual presentation and keyboard navigation; fullscreen; WebGL-unavailable fallback; complete automatic playback at 2× with no page errors or console errors.

Automated axe WCAG 2 A/AA and 2.1 AA checks pass for Overview, Investigation and backend-error dialog. This is not a full manual accessibility certification. Keyboard and control behavior also receive component/browser tests.

Responsive checks: 1920×1080, 1440×900, 1366×768, 768×1024, 390×844 and 320×740, with no horizontal document overflow. Desktop presentation controls fit 1920×1080, 1440×900 and 1366×768. Small projector layouts use a scrollable evidence panel; mobile uses normal page scrolling.

## Visual inspection
Captured and inspected [hero](screenshots/hero.png), [overview](screenshots/overview.png), [vision](screenshots/vision.png), [telemetry](screenshots/telemetry.png), [investigation](screenshots/investigation.png), [AMD architecture](screenshots/amd.png) and [final demo](screenshots/final.png), plus mobile and projector screenshots in the local Playwright output.

Fixed issues found during inspection/testing: oversized close-up labels, mobile framing, grid extending outside the floor, low-contrast secondary labels, invalid ARIA on the canvas wrapper, dynamic 3D HTML-label root cleanup error, selected sensor readout mismatch, and selected-event changes during telemetry scrubbing. The final labels are ordinary React DOM projected from the scene. Tests execute the actual application; fallback tests disable WebGL while retaining 2D canvas support.

## Measured performance
Raw measurements: [FRONTEND_PERFORMANCE.json](FRONTEND_PERFORMANCE.json). Reproduce with a preview server and `PLAYWRIGHT_CHROMIUM_EXECUTABLE=… node scripts/measure-browser.mjs`; use PERF_BASE_URL to change the origin.

- Three independent local page loads: ready at 272.5, 238.4 and 242.4 ms; FCP at 112, 80 and 72 ms. Ready means the projected Vision station control is available, not a web-vitals score.
- Transferred resources: 364,515 bytes in each recorded local load.
- Five-second animation sample: 301 requestAnimationFrame callbacks / 5,016.5 ms, average 60.00 callbacks/s, median interval 16.7 ms, p95 16.8 ms; zero intervals above 50 ms.
- Twenty replay/navigation cycles after warm-up and explicit garbage collection: heap 11,529,496 → 12,258,748 bytes (+729,252); DOM nodes 483 → 483; event listeners 226 → 226; documents 1 → 1.
- Production JS: app approximately 360 KB raw / 111 KB gzip; lazy 3D approximately 912 KB raw / 246 KB gzip. CSS approximately 24 KB raw / 5.7 KB gzip.

Budget: combined gzip JavaScript under 400 KB; bounded DPR at 1.5 and shadow map at 1024²; usable 60 Hz desktop interaction target. The local measurements meet these targets. RAF cadence is not a GPU inference benchmark and does not guarantee other hardware performance. The memory run is short; it does not establish absence of all leaks. No long-duration soak, low-end mobile GPU, Safari, Firefox or physical projector test was performed.

## Integration and truthfulness
Real backend, model, dataset, retrieval, manual citations and AMD execution remain unavailable. Live tests use explicitly mocked HTTP responses. Guided images, scores and telemetry are authored synthetic fixtures. Live localization/image rendering is not implemented. No first-visit offline installer/service worker exists; loaded guided mode works without the network.

## Delivery
Feature branch: `feat/interactive-3d-factory-experience`. GitHub and deployment results are recorded in the PR and final delivery message after publication. No main-branch merge is authorized or performed.
