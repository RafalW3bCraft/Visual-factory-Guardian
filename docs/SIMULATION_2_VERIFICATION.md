# Simulation 2.0 — executed verification

> Historical record of local commit `2397ecb`. The current user-approved design restores the video reference; see [Refined factory story](REFINED_FACTORY_STORY.md). Counts and screenshots below describe the earlier implementation.


Date: 18 October 2026 (Asia/Almaty).

## Workspace and delivery

Implementation uses the clean existing checkout at `/private/tmp/vfg-redesign-20261016`, because macOS denies access to the chat's Documents workspace even with sandbox escalation. The checkout remote is `https://github.com/RafalW3bCraft/Visual-factory-Guardian.git`; its starting branch was `codex/cinematic-factory-experience`. No teammate changes were present before editing. The implementation is prepared on local branch `codex/interactive-factory-simulation-2`. No push, PR, remote commit or deployment was performed.

## Executed checks

| Check | Result |
| --- | --- |
| `npm test` | 31 passed across 5 files, including 9 new timeline/reducer tests |
| `npm run build` | Passed: TypeScript and Vite production build |
| `npm run format:check` | Passed after formatting the new source |
| Full Playwright suite | 13 passed, including all preserved original-console regression tests; the 6 new-workflow checks also passed again after final mobile/geometry polish |
| Backend `python -m pytest -q` | 79 passed after generating deterministic fixture images |
| `git diff --check` | Passed |

Node 25.8.1, Chrome 155.0.8059.82, Python 3.12.13. Tests run on local macOS, with an installed Chrome binary. No real mobile hardware, Firefox, Safari, AMD GPU or production camera was tested. Existing dependencies emit Zod annotation warnings at build time and a Starlette/httpx deprecation warning during backend tests; these did not fail the checks.

Initial backend testing failed because an optional `lspci` fallback raised FileNotFoundError on macOS. The guarded fallback and two regression tests fix that startup failure. The initially skipped PatchCore-lite integration test was subsequently executed after generating its synthetic images; the final backend run has no skips.

## Browser evidence

`frontend/tests/landing.spec.ts` captures screenshots under ignored `frontend/test-results/`:

- `simulation-7.png`, `simulation-11.png`, `simulation-16.png`: approach, grip/lift and transfer.
- `simulation-28.png`, `simulation-33.png`: spatial tracking and surface anomaly.
- `simulation-38.png`, `simulation-48.png`, `simulation-54.png`: sensor context, explanation and handoff.
- `simulation-evidence.png`: magnified affected surface and fixture metadata.
- `simulation-demo-review.png`: recorded operator decision.
- `simulation-mobile-{320,390,768,1440}.png`: step-control landing at different widths.
- `simulation-demo-{320,390,768,1440}.png`: functional operator review at different widths.

Assertions verify that stopping at T+11s leaves both the pose and canvas pixels unchanged, and that advancing to inspection and reversing produces the same pose and canvas pixels. The scene's detection label is checked inside its canvas bounds; physical overlay paths are children of the component transform. Timeline unit tests sweep the operation at 0.01s intervals for continuity and at 0.05s intervals for both link lengths. They verify attachment during handling, conveyor seating, inspection ordering, deterministic telemetry and bounded input.

Browser tests exercise start/pause/resume/restart, equipment focus, sensor selection, earlier reference evidence, region toggling, magnification, explanation expansion, all three operator outcomes, notes, history, landing/demo state transfer, browser history and original console access. Desktop/mobile WCAG A/AA automated checks pass. WebGL-disabled and JavaScript-disabled alternatives are verified. Existing presentation, full-screen, live-backend-error and playback-completion tests also pass.

## Local rendering measurement

A separate five-second Chrome headless run drove scroll continuously through the entire sequence at 1440×900. Observed browser RAF cadence was 60.00 fps, p95 interval 16.7ms, with zero intervals over 50ms. Instrumented WebGL draw calls remained at zero during a subsequent 500ms pause after settling. This is local browser scheduling/render evidence, not a cross-device performance guarantee or inference benchmark. No network throttling was applied.

## Review locally

Run `npm run dev` from `frontend` and use the printed address. The implementation session's preview is `http://127.0.0.1:5174/` while that process remains running.

1. Scroll slowly through handling, then reverse and stop midway through the lift.
2. At stage 05, open the affected surface, magnify it and toggle its region.
3. Advance to stage 08 and enter the demo; the current time is carried over.
4. Explore Equipment, Evidence and Investigation. In Review, add a note and record an outcome; inspect History.
5. Restart to clear the local session. Use the backend-console link to review preserved integrations.

## Limits

The scene is an industrial procedural illustration, not photorealistic footage. Mechanics are kinematically consistent but have no dynamics/collision solver. The visual defect, scores, telemetry, thresholds and explanation are fixed synthetic fixtures. The original backend is preserved and its CPU integration tests pass, but the new rendered cell does not perform model inference. Operator decisions live only in the current demo session, and no work-order API is implemented. Full visual 3D requires WebGL2; fallback controls and evidence remain functional.
