# Interactive frontend architecture

## Scope
`frontend/` is an independent Vite build within the existing repository. The baseline repository had no application implementation. Existing team plans are preserved. The frontend implements a procedural WebGL demonstration, not an operational digital twin or industrial controller.

## Modules
- `src/simulation/engine.ts`: pure reducer, shared time, stable product/event IDs, deterministic signal formulas, evidence-window calculations.
- `src/simulation/scenes.ts`: nine story stops and camera/evidence checkpoints.
- `src/components/Factory.tsx`: procedural cell, conveyor, products, equipment, lighting, camera director, projected DOM labels and WebGL fallback. Static geometry is memoized; conveyor rollers are instanced. DOM labels are projected from world coordinates without separate React roots.
- `src/components/Panels.tsx`: normal/flagged illustrations, evidence ledger, timeline, operator review, AMD architecture.
- `src/components/Telemetry.tsx`: three SVG charts, baseline, drift/inspection markers, selected window, pointer sampling and scrub action.
- `src/components/LivePanel.tsx`: explicitly separate live workspace, readiness gate, scenario controls and server-only records. Session state survives closing/reopening the panel within the page.
- `src/services/api.ts`: Zod validation, HTTP error handling, eight-second timeout, cancellation and scenario/event identity checks.
- `src/App.tsx`: scene/navigation orchestration, keyboard controls and scenario clock. Hidden tabs and open backend dialogs suspend the simulation clock.

## Data boundary
The guided scene is self-contained and has no network calls. The live workspace does not share guided telemetry, scores or explanations. API records must declare provenance. No failure falls back to fixtures. A live server's `source: simulated` remains simulated even though delivered over a live API.

No backend exists in the audited commit. The frontend adapter is a concrete proposal extending the original draft contract; it needs team agreement and end-to-end verification against a real service. See FRONTEND_API_INTEGRATION.md.

## Rendering and accessibility
Three.js is loaded in a separate chunk. Geometry, illustrations and styles are bundled; no textures, external fonts or model assets are requested at runtime. Pixel ratio is capped at 1.5, shadow maps at 1024², and postprocessing is omitted. Static geometry remains mounted across replay. Reduced motion starts paused and uses immediate camera transitions. WebGL failure retains the textual investigation and all HTML controls.

Equipment HTML buttons duplicate mesh interaction. The timeline and range input provide keyboard alternatives to charts. Presentation shortcuts ignore editable controls and preserve native button Space activation. Mobile uses a reframed camera and stacked evidence, while desktop presentation mode fits its main controls into the viewport.

## Limits
The procedural scene does not represent a validated real machine. Product illustrations and scores are synthetic. No localization heatmap, public dataset image, manual quotation, ML inference, LLM response or AMD benchmark is included. The API workspace currently renders typed server records and explanation text; live image/localization media and live 3D motion are not integrated.
