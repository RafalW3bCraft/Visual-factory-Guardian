# API Contract — Draft

All timestamps use ISO 8601 UTC. Every event includes `scenario_id` and `line_id`.

## Proposed endpoints
- `POST /api/v1/scenarios/start`
- `POST /api/v1/scenarios/stop`
- `GET /api/v1/events`
- `GET /api/v1/sensors`
- `GET /api/v1/analysis/{event_id}`
- `GET /api/v1/health`

## Inspection event fields
`schema_version`, `event_id`, `timestamp`, `scenario_id`, `line_id`, `image_id`, `detection`, `sensor_evidence`, `candidate_causes`, `manual_citations`, `recommended_action`.

## Sensor record fields
`timestamp`, `scenario_id`, `line_id`, `sensor_id`, `metric`, `value`, `unit`, `source`, `fault_state`.

This contract is a proposal. Team members should agree on it before implementation and keep examples synchronized with the actual API.
