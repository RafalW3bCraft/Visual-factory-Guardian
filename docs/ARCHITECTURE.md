# Architecture Decisions

## First vertical slice
One image category, one line, one repeatable scenario, one operator workflow.

## Data flow
Image source -> vision inference -> image event; telemetry simulator -> sensor events; event alignment -> statistical evidence -> root-cause candidate ranking and manual retrieval -> API -> dashboard.

## Separation of concerns
- Vision module emits model ID, score, timing, and localization reference if available.
- Sensor module emits timestamped readings and statistical evidence.
- Root-cause module ranks candidates using structured evidence.
- LLM explains evidence and retrieved passages; it does not establish causation.
- API validates contracts and serves the UI.

## Open decisions
- Selected MVTec AD category
- Exact AMD GPU / ROCm / PyTorch environment
- Frontend framework and persistence mechanism
- Change-point method and baseline window
- Exact model and inference thresholds
