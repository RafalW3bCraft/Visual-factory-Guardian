# Frontend deployment

The application is a static Vite build; no backend is needed for Guided Simulation. Deploy only `frontend/`, keeping the existing repository as source.

## Vercel
- Import the existing GitHub repository.
- Select branch `feat/interactive-3d-factory-experience` for a preview; do not merge main automatically.
- Root directory: `frontend`.
- Framework: Vite; Node: 22.x or 24.x.
- Install: `npm ci`; build: `npm run build`; output: `dist`.
- Leave `VITE_API_BASE_URL` unset for the standalone demo. Set it only when a public HTTPS backend implements the adapter contract.
- `frontend/vercel.json` supplies static routing and basic response headers.
- Open the generated URL and verify canvas, scenario, replay, deep-link fallback and asset loading. Deployment is successful only after this check.

A local production preview is reproducible with `npm run preview -- --port 4173`. Its localhost URL is not a public deployment. See FRONTEND_TEST_REPORT.md for the actual deployment/publication outcome of this implementation.

## Assets and licenses
All factory geometry and product illustrations were authored procedurally for this frontend. No MVTec images, third-party 3D models, external textures, music or fonts are included. Lucide icons and npm libraries retain their upstream licenses in the dependency packages; inspect the lockfile/package license files for exact versions. The original repository has no project LICENSE file, so no new project-wide redistribution license has been asserted. The owners should choose one before presenting the repository as open-source software.

## Verified publication outcome
On 15 October 2026 the feature branch was pushed and [PR #1](https://github.com/RafalW3bCraft/Visual-factory-Guardian/pull/1) was opened. Main was not merged.

Vercel project `visual-factory-guardian` was created (project ID `prj_A5hUiULVQHHrVrdbLBXSXnTnSVA8`, team ID `team_fOEXDlvAZC67JiVN1Dt8PQUl`). The deployment request then failed with HTTP 403: the connector was not authorized for scope `donyas-projects-22c35d05`. The documented CLI fallback was attempted for the same team/project and reported no stored credentials; its interactive login was cancelled.

No deployment was created or verified, and there is no public site URL to report. The next step is to authorize the Vercel connection for that team or run `vercel login` locally, then deploy the existing project from this feature branch. No credentials are stored in this repository.

## Cinematic landing update — 16 October 2026

The landing story is served at `/`; the existing operator app is preserved at `/dashboard`. Existing SPA rewrites support both routes. Use the `codex/cinematic-factory-story` branch for review of this change. The landing has no API dependency and never silently substitutes a fixture for a live result.

Unlike the original dashboard, the landing includes locally bundled Barlow Condensed and DM Sans fonts (SIL OFL 1.1); license copies are served under `/licenses/`. The current repository also contains an MIT LICENSE. No video-reference frames, public benchmark images, third-party 3D models or proprietary assets are redistributed. The original deployment outcome above is historical, not evidence of a public deployment for this branch.

See `CINEMATIC_VERIFICATION.md` for executed browser checks, responsive screenshots, performance measurements and publication status.

## Backend

The Python FastAPI service is launched as a single module; the launcher
auto-loads the project-root `.env` and parses CLI flags.

### Required environment

| Variable | Purpose |
|---|---|
| `VFG_API_BEARER_TOKEN` | Optional. When set, mutating endpoints (`/scenarios/start|stop`, `/analysis/{event_id}`) require `Authorization: Bearer <token>`. Read-only endpoints stay open. |
| `VFG_CORS_ORIGINS` | Comma-separated exact origins allowed by the browser. Defaults to `http://localhost:4173` + `:5173`. **Set this to the deployed frontend origin** (`https://factory.example.com`) or the dashboard will be blocked. |
| `VFG_VISION_BACKEND` | `synthetic` (default, no deps) / `patchcore-lite` (CPU, requires populated `VFG_FIXTURE_ROOT`) / `anomalib` (AMD ROCm, requires `VFG_MVTEC_ROOT` + `VFG_MVTEC_CATEGORY`) / `auto`. |
| `VFG_LLM_ENDPOINT` | AMD OpenAI-compatible chat-completions URL. Leave unset to run the deterministic explainer. |
| `VFG_LLM_MODEL` | Model id served at that endpoint. |
| `VFG_LLM_API_KEY` | Bearer token. Never logged. |
| `VFG_LLM_TIMEOUT` | Seconds before the LLM call is abandoned (default 30). |
| `VFG_LLM_CB_FAILS` | Consecutive failures before the circuit breaker opens (default 5). |
| `VFG_LLM_CB_COOLDOWN` | Seconds the breaker stays open before a half-open probe (default 60). |
| `VFG_LOG_LEVEL` | `DEBUG`/`INFO`/`WARNING` (default `INFO`). |

### Launch

```sh
python -m backend.api.server --host 0.0.0.0 --port 8000
```

For multi-worker deploys, the launcher is still single-worker because
`RuntimeRegistry` is process-local — every worker has its own scenario
state. Use a single-worker reverse-proxied deploy (recommended) or accept
that a client may need to retry to hit a worker that warmed its scenario:

```sh
gunicorn -k uvicorn.workers.UvicornWorker backend.api.app:app -w 2 -b 0.0.0.0:8000
```

### Health

- `GET /api/v1/health` — overall readiness. Returns `status: "degraded"` with `vision_backend_error` when the vision backend failed to initialize.
- `GET /api/v1/analysis/health` — LLM readiness + circuit-breaker state (`llm_failure_count`, `llm_circuit_open`).
- `GET /api/v1/scenarios` — list of loaded scenario ids.

### Reverse proxy + TLS

The launcher binds plain HTTP. Put a TLS-terminating proxy in front for
production. Recommended: Caddy or nginx with the deployed frontend origin
in `VFG_CORS_ORIGINS`. No WebSocket endpoints today; HTTP/1.1 is sufficient.

### Hard-fail checklist

`patchcore-lite` will refuse to boot when `VFG_FIXTURE_ROOT` does not
exist. `anomalib` will refuse when `VFG_MVTEC_ROOT` or `VFG_MVTEC_CATEGORY`
is unset. Both errors name the missing variable — surface them in your
service supervisor's logs.
