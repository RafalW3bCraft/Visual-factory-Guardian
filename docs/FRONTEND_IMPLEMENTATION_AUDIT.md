# Frontend implementation audit — 15 October 2026

## Verified baseline
- Repository origin: RafalW3bCraft/Visual-factory-Guardian. Base commit: 0e907d1.
- Clean `main` checkout, one local/remote branch and one commit. All six existing documentation files were read.
- Existing files are README and five planning documents. No application source, dependencies, assets, datasets, tests, environment files, API server or deployment configuration exists.
- API_CONTRACT describes proposed endpoints, not implemented services. Dataset category and license are undecided. AMD_SETUP contains unfilled measurement fields.
- Team ownership in README is preserved; no Python, model, telemetry-owner or reasoning-owner implementation is overwritten.
- Dedicated branch: feat/interactive-3d-factory-experience.

## Strategy and dependencies
Add `frontend/` with React, TypeScript, Vite, React Three Fiber and procedural local geometry. A pure deterministic reducer and fixture generator coordinate product identities, timestamps, telemetry and evidence. The bundled scenario is explicitly synthetic. No dataset images, heatmaps, manual excerpts or model output are fabricated as real results.

A separately selected Live API mode validates responses from the proposed endpoints. Until a team backend is available, this is an integration adapter, not a verified service. Guided mode never depends on network access after application assets load. All original planning documents remain authoritative for future backend implementation.

## Design contract
- Job: investigate a flagged component and understand what evidence supports human inspection.
- Primary action: launch the guided investigation; secondary action: explore machinery.
- Hierarchy: factory and product story, inspection status, synchronized evidence, candidate and action.
- Navigation: nine manually paced scenes, equipment controls, timeline, presentation keyboard controls.
- Visual language: graphite canvas, precision grid, warm off-white typography, amber investigation accents, cyan sensor traces. No decorative KPI cards or arbitrary analytics.
- States: loading, running, paused, completed, reviewed, API unconfigured, connecting, failed, empty, and unsupported WebGL.
- Responsive: desktop two-column stage; small-screen factory above concise evidence, scrollable navigation and controls. Semantic HTML duplicates all 3D actions.
- Evidence: repository workflow and supplied brief; UIZZE catalogue was opened but relevant individual screen references were not retrievable through available search. No claim of reviewing unavailable references.
- Acceptance: coherent real geometry, deterministic replay, source labels, complete investigation, keyboard controls, validated API errors, production build and executed browser checks.

## Initial blockers
- External code indexing was rejected by automatic approval review because it exports repository contents. Local inspection is used instead.
- Sandboxed GitHub DNS resolution failed; `gh auth status` reported an invalid stored token. An authorized network retry later verified valid keyring authentication and push permission; the remote HEAD still matched 0e907d1. The initial auth failure was caused by sandbox networking.
- No verified backend, dataset, reasoning service, maintenance manual or AMD hardware. These remain explicitly unavailable.

## Reference evidence limits
The public UIZZE catalogue and indexed descriptions were consulted. Three individual source pages returned HTTP 410 when opened: [Owner Dashboard](https://uizze.com/screens/699b447d001169993d53), [Spending period](https://uizze.com/screens/699b41ce002688d29f0e), and [Empty state](https://uizze.com/screens/699d3b46001ba29fb8d5). No screen imagery or exact layouts were copied. The limited descriptions informed progressive disclosure, explicit time selection, and truthful empty-state wording; the supplied industrial workflow determined the actual design.
