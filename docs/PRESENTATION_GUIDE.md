# Two-to-three-minute demonstration

## Launch
From the repository root:

```sh
cd frontend
npm ci
npm run build
npm run preview -- --port 4173
```

Open http://127.0.0.1:4173. Wait for the factory to render before disconnecting the network. Desktop Chrome or another modern WebGL2 browser is recommended; only the tested browser/environment is reported in FRONTEND_TEST_REPORT.md.

## Presenter route
1. Click **Presentation mode**. This disables automatic story advancement. On desktop the primary controls stay inside the viewport. Use **Toggle fullscreen** if desired.
2. **Overview:** “Every defect has a story.” Describe the simulated line. Drag to orbit, scroll to zoom, or use Reset view.
3. **The problem:** use Next scene or Right Arrow. The checkpoint contains a normal inspection. Detection alone does not explain process changes.
4. **Computer vision:** compare **Normal · P-001** and **Flagged · P-004**. Say explicitly that these illustrations and scores are synthetic; no CV model or localization has been run.
5. **Telemetry:** select Temperature, Vibration or Motor. Scrub the clock; point to 18s drift and 32s inspection. All three signals are simulated.
6. **Timeline:** click a timestamp to align the scenario, then return to the 40s checkpoint if needed.
7. **Investigation:** expand E01/E02/E03 and distinguish observed fixture data from the thermal hypothesis. Correlation does not establish causality.
8. **Operator action:** mark the demo inspection reviewed. Explain that there is no real machinery control and no supplied manual citation.
9. **AMD architecture:** explain the browser/application/analysis/compute layers. AMD evaluation remains pending; do not call the browser visualization an AMD inference workload.
10. **Try the demo:** let judges replay the guided investigation or inspect backend readiness. The GitHub link opens the project.

## Navigation
Right/Left Arrow: next/previous scene. Space: pause/resume when focus is outside a native button or input. R: restore current scene checkpoint. Escape: exit presentation. Buttons provide all the same actions. Range inputs retain their native arrow-key behavior. Scene navigation pauses at checkpoints; press Play to animate that checkpoint. Restart presentation returns to scene 01/time zero and clears the local review state.

Outside Presentation mode, **Launch investigation** automatically advances the story during the 56-second fixture. Manual scene, sensor, product or time selection cancels automatic guidance. The final investigation can be replayed without refreshing.

## Recovery
Backend not configured or unavailable: close its workspace with **Return to Guided Simulation**. Live failures never supply fixture results. If a live scenario started, use **Stop live scenario**; closing its panel preserves session controls until page reload.

Unsupported/lost WebGL: the simplified process diagram appears, with full evidence and controls still usable. Reduced-motion preference starts paused and removes interpolated camera transitions. At narrow/mobile widths the content scrolls; use desktop for a projector.
