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
