# Cinematic landing implementation plan

Audit baseline: `bb1e6e2` on main; clean fresh checkout. The original Documents workspace is inaccessible to the OS, so this implementation is isolated in `/private/tmp/vfg-redesign-20261016` on `codex/cinematic-factory-experience`.

1. **Architecture:** React 19 / TypeScript / Vite; a stateful procedural Three.js demo, deterministic frontend simulation, Zod live API adapter; FastAPI, synthetic telemetry, CPU PatchCore-lite and optional Anomalib backends. No landing photos or scroll library. Existing tests use Vitest and Playwright. Vercel static configuration.
2. **Problem:** The entry screen is the control-dense demo itself: tabs, telemetry and panel borders compete with procedural geometry. It offers no photographic introduction or continuous visual narrative.
3. **Preserve:** Entire demo, presentation, local review, replay, telemetry, backend readiness checks, all API contracts and Python code. Keep original #experience deep link as a demo alias.
4. **Redesign:** A separate entry page, native anchor chapter navigation, cinematic hero, shared sticky machinery scene for chapters 2–4, an editorial evidence investigation, a wide final scene. Existing demo at #/demo, lazy-loaded with its CSS and WebGL dependencies.
5. **Assets:** Two original generated photorealistic illustrations with consistent lighting (wide hall, motor/coupling), locally optimized WebP at multiple widths. Reuse crops for visual continuity; disclose generation in the page and asset manifest. No claims of customer installations.
6. **Scroll:** One native sticky sequence, no wheel interception. A passive scroll listener schedules one rAF, uses cached geometry refreshed by ResizeObserver, and writes transform/opacity CSS variables directly. Native scroll and reversible progression; no animation dependency. Mobile and reduced motion use natural static scenes.
7. **Risks:** Overlaid contrast, small screens, keyboard access, image failure, expensive decoding and leaking listeners. Use explicit scrims, semantic sections, focus rings, touch-sized anchors, responsive sources, lazy media, cleanup. No inference is performed on the generated photos.
8. **Verification:** Production build/typecheck, existing unit and E2E suites (demo URL updated only), landing Playwright tests for seven widths, chapter navigation, reverse scroll, demo return, image failure, reduced motion, axe checks, screenshots and browser metrics. Review diff and commit/push branch without touching main.

## Design contract

- **Screen job / user:** Help a visiting engineer understand image → sensor context → cautious investigation, then enter the functional simulation.
- **Primary action:** Explore the experience; demo links always identify the simulation.
- **Hierarchy:** Factory scale, component attention, visual observation, fixture telemetry, evidence/human review, working demo.
- **Visual language:** Graphite, off-white, restrained signal amber, large tightly set editorial headlines, fine rules and technical captions; no card grid or decorative charts.
- **Controls:** Native chapter links, visible progress, existing demo entry and return; no scroll capture.
- **States:** Immediate image before React; media failure retains text and exposes explanation; demo Suspense fallback; no invented live state.
- **Responsive:** Desktop sticky machinery / mobile flowing compositions with focal crops; reduced motion reveals all evidence without parallax.
- **References:** https://morphowater.com/ supplies numbered story pacing, sparse navigation and image-led hierarchy. Branding, imagery, text and preloader are not copied. https://uizze.com/ and its Web catalogue were opened but exposed no individual reference screens to the available text browser; that reference evidence is unavailable. The user's detailed creative brief and actual product are the design authority.
- **Forbidden defaults:** Dashboard as hero, synthetic inference confidence on photographs, customer logos, unsupported maturity claims, repeated cards, gradients as the primary image.
- **Acceptance:** Six complete chapters with working local imagery, no overflow at 320/375/390/430/768/1024/1440, keyboard and motion-safe story, preserved demo tests, no critical asset/network failures.
