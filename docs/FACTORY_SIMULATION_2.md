# Factory simulation 2.0

## Entry points and product truth

- `/`: one native sticky, reversible manufacturing scene. Eight stages share the same cell, component and camera.
- `/#/demo`: interactive operator workspace. `?t=32` in the fragment seeds the scenario time, clamped to 0–56 seconds. Landing links preserve the current time.
- `/#/console`: original factory simulation, presentation mode, telemetry and live API readiness workflow. `#experience` remains a legacy alias to this console.

The new experience is a procedural industrial visualization, not photorealistic footage, a digital twin, live camera inference or a robot controller. Inspection, telemetry and explanation use reproducible fixtures from the existing `thermal-drift-001` scenario. No LLM inference, external work order, hardware actuation or causal diagnosis is claimed. Existing CPU PatchCore-lite and optional Anomalib integrations remain separate from the new visual scenario. Backend responses are available through the original console when an API URL is configured.

## Timeline and mechanics

`src/experience/timeline.ts` is a pure function from normalized progress to the full scene state. Progress is clamped and multiplied by 56. Explicit smoothstep keyframes specify the tool position, gripper opening, conveyor transport, camera and target. The shoulder is fixed, and two-link inverse kinematics solves the elbow while preserving 1.85 and 1.70 unit link lengths. A level wrist keeps the flange horizontal. No independent robot or conveyor timer exists.

| Scenario time | Operation |
| --- | --- |
| 0–4 | Wide view, robot and component stationary |
| 4–8.5 | Tool approaches feeder and fingers close |
| 8.5–11 | Component follows the tool during lift |
| 11–17 | Transfer to conveyor and lower component |
| 17–18.5 | Release, followed by robot retreat |
| 18.5–28 | Conveyor advances flange to CAM-01 |
| 28–32 | Tracking region and progressive inspection scan |
| 32–35 | Fixed surface anomaly, captured evidence and closer camera |
| 35–44 | Synthetic sensor trend and temporal context |
| 44–50 | Five evidence/reasoning steps become available |
| 50–56 | Operator decision and handoff into interactive demo |

The part stays at tool position minus its fixed vertical offset during handling and sits at conveyor height after release. The scan, bounding box and defect region are in component-local coordinates. Camera projection places DOM tracking labels over that same component. The flange mesh and magnified SVG evidence share the exact crack coordinates. Evidence is labeled a reconstructed fixture frame, not a camera photograph. Earlier P-001–P-003/P-005–P-006 records are reference fixtures; their handling cycles are not animated in this single-component sequence.

Native scroll events are coalesced with `requestAnimationFrame`. The state is derived from the sticky section's document position; no wheel or touch events are intercepted. Stopping scroll stops all movement. Rewinding re-evaluates the same keyframes. Three.js uses demand rendering, a capped 1–1.5 pixel ratio, static memoized hall geometry, reusable link extrusion and one 1024px shadow map. It does not accumulate wall-clock animation while idle.

## Operator workflow

`Experience.tsx` provides seven useful work areas: Overview, Inspection, Equipment, Evidence, Investigation, Review and History. A single reducer controls demo time, playback and decisions. Playback advances that same timeline; seeking pauses it. Start, resume, pause and restart have distinct state effects. Hidden tabs do not advance scenario time. Reduced-motion settings disable auto camera travel, and playback only begins after an explicit click.

Equipment controls focus the robot, camera or drive. Evidence opens in a native modal dialog with keyboard focus containment, Escape dismissal, region toggling and magnification. Temperature, vibration and current use the existing deterministic `reading()` function, including 82.49 °C at T+32s. Thresholds are illustrative. The 14-second temporal lead is not proof of cause. The investigation discloses its fixed explanation, alternative explanation and uncertainty.

Operator review is gated until T+50s. Confirm, reject and request inspection each append a distinct, ordered local record with an optional engineering note. Seeking retains the audit history; Restart clears it. Refreshing or leaving the demo discards the session. No server persistence or work-order API was added.

## Assets and portability

All new geometry, machined flange surfaces, floor texture and evidence illustration are authored procedurally in the repository. No external model, HDR, font, image or remote CDN is required. The environment map is generated from Three.js's bundled RoomEnvironment. Existing React Three Fiber, Drei, Three.js and lucide dependencies are reused; no frontend dependency was added. Existing photographic assets and their provenance remain historical resources.

The scene has beveled robot links, joint housings and fasteners, a two-finger gripper, a feeder fixture, roller conveyor, drive fins, cabling, inspection gantry, ring light, cabinets and factory framing. It is an illustrative mechanism: joint torque, collisions, payload limits and safety zones are not physically simulated. The WebGL fallback is a deliberately simplified process diagram with the evidence and operator controls still available.

The optional AMD hardware probe had an unguarded `lspci` fallback that prevented API startup on macOS. It now returns no detected hardware when the optional command is unavailable or times out; regression tests cover both cases. This does not claim AMD hardware validation.

## Run and verify

```sh
cd frontend
npm ci
npm run dev
npm test
npm run build
npm run format:check
npm run test:e2e
```

Use installed Chrome with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, or install Playwright Chromium. Browser tests run against the production build at port 4173. Existing console regression tests retain their behavior assertions, with entry URLs updated to `/#/console`.

```sh
# From repository root, with Python dependencies installed:
python -m backend.vision.fixtures --scenario thermal-drift-001
python -m pytest -q
```

Generated backend fixture images are test inputs, not the flange illustration. They should stay local. No real dataset is downloaded. See the verification report for actual executed results and the tested environment.
