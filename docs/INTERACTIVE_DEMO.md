# Thermal drift investigation

## Reproducibility
Scenario: `thermal-drift-001`; line: `line-01`; UTC epoch: `2026-10-15T10:00:00Z`; duration: 56 seconds. This timestamp is a fixed fixture epoch, not a real observation date. The clock may play at 0.5×, 1× or 2×, pause, seek and reset. Hidden tabs do not advance it. Explicit seek pauses playback.

Six products `P-001` through `P-006` cross the inspection station at seconds 8, 16, 24, 32, 40 and 48. Each has a stable `evt-001` through `evt-006` identity. Only P-004 is flagged, with synthetic score 0.87. The illustrative threshold is 0.65; scores are not probabilities. Product position is a pure function of this clock and its inspection time, so each product reaches x=2 at its own inspection.

## Signals
For time t clamped to [0,56], drift d = clamp((t−18)/18,0,1). Readings are rounded to two decimal places:

- Temperature (°C): 64 + 24d + 0.35 sin(0.9t).
- Vibration (mm/s): 2.1 + 0.8d + 0.12 sin(1.7t).
- Motor current (A): 42 + 7d + 0.5 sin(0.6t).

These are authored illustrative ranges, not real machinery limits. Charts sample each integer second. The header shows the selected clock time or hovered reading. Dashed baseline, amber drift marker at 18s and red inspection marker at 32s share one time axis. The highlighted selected-event window is [event−18,event+8], clamped to the scenario bounds. The complete synthetic fixture is visible, including future samples; it is not a live-history chart.

## Evidence
E01: the selected inspection fixture and threshold.
E02: temperature at that inspection minus the mean baseline from seconds 0–17.
E03: time difference between drift onset and inspection. P-004 follows drift by 14 seconds; P-001 precedes it.

At 38s evidence is assembled; at 44s investigation becomes available. The explanation proposes checking thermal process stability with sensor calibration error as an alternative. It is deterministic, not LLM generated. No causal certainty or confidence percentage is asserted. No maintenance manual was supplied; the UI says so explicitly.

## Controls
Launch investigation starts automatic narrative progression. Clicking any scene, equipment control or time position switches to manual exploration. Presentation mode always uses manual scene progression. Restart demo returns to time zero and clears review; Play starts from that state. Replay scene restores the current scene's checkpoint. A demo review is local ephemeral state and sends no commands to machinery.

## Offline behavior
All app assets must load once, or be served from a local production preview. Thereafter the guided workflow requires no network. A completely offline first visit to a remote URL is not supported; there is no service worker or offline installer.
