# Refined factory story

Date: 18 October 2026 (Asia/Almaty).

## Approved direction

The user selected the ivory landing and dark Demo Mode shown in their reference video, rather than a literal reversal of the last two commits. The matching story implementation is `ae660204b1f3d9c71a2c0498764b8e04f5bac602`. This change restores its seven-chapter narrative, then refines its shared equipment and rendering. The rejected robotic design remains recoverable in local commit `2397ecb`; the unrelated optional PCI-probe startup fix is retained.

## Implementation

- `frontend/src/cinematic/Landing.tsx`: seven chapters, native scroll, GSAP progress, keyboard chapter navigation, truthful fixture annotations and evidence disclosure.
- `director.ts`: pure, reversible camera, product, exploded-assembly and lighting-tone state. Reduced motion uses discrete compositions. Three property tests cover round-trip identity, continuity and invalid inputs.
- `Hardware.tsx`: real flange through-holes and a turned open bore, beveled geometry, perforated vent cover, local brushed-metal microtexture, solid curved cables, socket fasteners and equipment plates. No downloaded models, HDRs, images or remote font requests.
- `Machinery.tsx` / `Lighting.tsx`: one shared assembly and studio rig for the landing and operator workspace. Slim rails, footpads, glass viewing door, heater coils, lens housing, ring light, directional soft shadows and broad reflection lights.
- `components/Factory.tsx`: the original dark workspace now renders the refined equipment. Retains orbit, zoom, equipment focus, product selection and projected labels; product coordinates align with the inspection camera. Paused/reduced/hidden views render on demand.
- `Site.tsx`, `base.css`: compatible demo routes and distinct light/dark surfaces on navigation, including browser back/forward.

The main story component, camera and exploded assembly derive from scroll progress. Background parts/roller texture use a separate pausable ambient phase, matching the reference's living production line. The demo uses the existing deterministic 56-second simulation and its real backend-readiness adapter. This restoration intentionally returns to the reference's conveyor story and original review workflow; it does not retain the rejected robot sequence or its additional decision-history UI.

## Assets and truth

All equipment geometry, texture grain and labels are generated locally in code. Barlow Condensed and DM Sans are bundled from Fontsource; OFL text is included in `frontend/public/licenses/`. GSAP is added for the restored scroll implementation. Original photographic assets are retained as historical files but are not requested by this landing.

This is a polished illustrative 3D model, not photorealistic camera footage, a calibrated digital twin, physical robot control or live vision inference. Scores, signals and the guided explanation are authored synthetic fixtures. The 14-second lead is a temporal relationship, not proof of cause. The live-analysis workspace remains separately gated on API readiness. No AMD hardware claim is added.

## Verification

Final checks were executed against this implementation. Browser checks run on local Chrome with the production Vite preview, not mocked screenshots. Screenshots are generated under ignored `frontend/test-results/`.

- Unit tests: 25 passed across 5 files.
- TypeScript / Vite production build: passed.
- Prettier: passed.
- Browser regression: 12 passed (1.4 minutes), including all original console checks.
- Backend regression: 79 passed, no skips. Two localhost server tests required sandbox permission to bind their temporary port.
- Runtime dependency audit: zero findings (`npm audit --omit=dev`).
- `git diff --check`: passed.

Automated browser coverage includes all seven story chapters, reverse camera/product/assembly state, pause/resume, keyboard navigation, light/dark route transitions, legacy `/dashboard`, four landing widths (320, 390, 768, 1440), the original demo's six viewport widths, presentation/fullscreen, inspection/evidence/review, replay, backend failure recovery, offline guided simulation, WebGL fallback and no-JavaScript fallback. Axe checks cover WCAG A/AA tags on the active story and console states; automated checks do not replace a complete accessibility audit.

The existing Vitest 3 development dependency tree reports three audit findings (Vitest, @vitest/mocker and tinypool); resolving them requires a separate major test-tool upgrade. These are not shipped in the browser runtime. Zod comment-annotation warnings and a Starlette/httpx deprecation warning are non-fatal. No Safari, Firefox, physical mobile device or AMD GPU was tested.

## Review and delivery

Run `npm ci`, `npm run dev` from `frontend/`. Open the printed local address, scroll or select chapters 01–07, and enter **Demo mode**. The API is optional for Guided Simulation. Production verification: `npm run build`, `npm test`, `npm run format:check`, `npm run test:e2e` (set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome if needed).

Prepared locally on `codex/refined-industrial-story` in `/private/tmp/vfg-redesign-20261016` because macOS prevents access to the original Documents checkout. No GitHub push, pull request or deployment is authorized or performed. The earlier design remains in local Git history.
