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
