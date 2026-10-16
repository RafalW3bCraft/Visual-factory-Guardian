# The cinematic factory experience

## Entry points and preserved behavior

`/` is a six-chapter photographic introduction. `/#/demo` opens the existing React Three Fiber factory with its original playback, presentation, inspection, telemetry, local review and live API readiness workflow. `/#experience` remains a legacy alias for the demo. The demo header includes a return to the factory story. Browser back/forward follows native hash history. Chapter anchors are `#factory`, `#signals`, `#vision`, `#context`, `#understanding`, and `#next`.

No backend, inference, simulator, schema or API contract was changed. The existing demo tests now enter via `/#/demo`; their original assertions remain intact.

## Architecture

- `src/Site.tsx`: small hash dispatcher; lazy imports the existing App and its CSS only when entering the demo. Three.js is still independently lazy-loaded by App.
- `src/landing/Landing.tsx`: navigation, opening, investigation, final scene and footer.
- `src/landing/ScrollStory.tsx`: three semantic chapters sharing a single native sticky machinery view on desktop.
- `src/landing/Photograph.tsx`: responsive local WebP sources, meaningful alt text, eager/lazy priority and explicit media failure state.
- `src/landing/InspectionOverlay.tsx`: visual-only inspection frame, observation and two sensor annotations. Equivalent information remains in semantic text.
- `src/landing/content.ts`: chapter metadata, asset descriptions and a real import of the existing deterministic sensor fixture at T+32s.
- `src/landing/useCinematicScroll.ts`: passive scroll events scheduled through one requestAnimationFrame; cached section geometry, ResizeObserver invalidation, direct CSS property writes and complete lifecycle cleanup. No React state updates per scroll; no timer or animation loop when idle.
- `src/landing/landing.css`: scoped visual system. One sticky sequence, natural document scrolling, no wheel/touch interception. Reversible image zoom and inspection reveals. At widths below 768px and with reduced motion, chapters use static imagery with all meaningful text visible.

The opening photo and text exist in index.html before React initializes. Responsive preloads select only the appropriate opening image. No preloader blocks the page. Later images use native lazy loading; recurring scenes reuse cached files. Image sizes are reserved, no web fonts or external media are fetched. Background scrims retain text contrast. Keyboard anchors, skip link, visible focus and a minimal progress rail provide direct navigation.

## Product truth

- **Implemented:** frontend guided simulation; deterministic synthetic inspection events and telemetry; traceable, deterministic explanation and local review. Repository backend includes FastAPI, telemetry, CPU PatchCore-lite and an optional Anomalib integration. Those backend modules are preserved, not independently validated on this host by this frontend task.
- **Illustrative:** all photographic environments, the highlighted coupling and inspection frame. No inference is run on these generated images. They do not depict customers or real installations.
- **Synthetic:** displayed temperature/vibration/current come from `reading(metric, ANOMALY_TIME)` in the original simulation. At T+32s: 82.49 °C, 2.62 mm/s and 47.62 A. The pictured motor is not their source. The 14-second lead comes from `ANOMALY_TIME - FAULT_TIME`.
- **Planned/unverified:** LLM-assisted explanation and manual retrieval; deployment-specific hardware connections, AMD execution and production diagnostic performance are not claimed.

## Assets and reproduction

Six optimized WebP files (two images, three variants each) live in `frontend/public/images`. See `manifest.json` there for source identifiers, chapter mapping, actual dimensions, bytes, mobile crops, priority and fallback. Full generation prompts are in [CINEMATIC_ASSETS.md](CINEMATIC_ASSETS.md).

The assets were generated using the built-in OpenAI image_gen tool for this project on 16 October 2026. They are photorealistic illustrations, not third-party stock or MVTec samples. No external image is hotlinked. Repository code remains MIT; generated media provenance is disclosed separately and no exclusive copyright or real-world authenticity is claimed.

Opening factory asset: 1600×800 desktop, 960×480 small desktop, 750×1100 mobile. Motor asset: 1536×1024 desktop, 960×640 small desktop, 750×1100 mobile. WebP quality 83; mobile crop retains the right-side robot (factory) and coupling (motor). Originals remain in the generation session; committed WebP files are sufficient to build and deploy.

## Develop and verify

Use Node 22.12+ (supported modern LTS recommended):

```sh
cd frontend
npm ci
npm run dev
npm test
npm run build
npm run format:check
npx playwright install chromium
npm run test:e2e
```

`npm run build` includes TypeScript checking. There is no separate lint script. To use installed Chrome instead of Playwright Chromium:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

Playwright starts a production preview on 127.0.0.1:4173. See `tests/landing.spec.ts` for viewport, navigation, no-WebGL-loading, reversed scroll, reduced motion, keyboard, axe, failed-media and no-JavaScript coverage. Existing demo E2E coverage remains in its original files. `test-results/film-*.png` contains screenshots generated by these tests.

## Browser support and limitations

Modern Chromium, Safari and Firefox supporting CSS sticky, WebP, ResizeObserver, matchMedia events, native lazy images and svh units. Only local desktop Chrome was executed in this task; real iOS/Android and Safari/Firefox performance remain unmeasured. The demo still requires WebGL2 for full 3D and retains its existing non-WebGL fallback.

The page uses two authored illustrations with reframing, not a video or true camera-move frame sequence. The machinery overlay is editorial, not a diagnosis. If an image fails, the story and links remain available over graphite with an unavailable-image caption. JavaScript is required for the full React story and demo; a photographic first frame and explanatory noscript message remain without it.

The installed lockfile reports existing Vitest development-tool advisories (one moderate, two critical dependency entries). No runtime dependency was added and no unreviewed major test-runner upgrade was included in this visual redesign. See the verification report for exact audit details and limits of measured performance.
