<!--
SYNTHETIC DOCUMENT — NOT A REAL MANUFACTURER MANUAL.
Written by team "void" for the AMD Developer Hackathon: ACT III demo.
All ranges, procedures and part names are illustrative for a SIMULATED ceramic-
tile firing line. They are not real industrial thresholds and must not be used to
operate real equipment. Section/page markers exist so the retrieval layer can
produce traceable citations.
-->
# Ceramic Tile Firing Line — Maintenance & Troubleshooting Manual (SIMULATED)

Document: TILE-LINE-01 Maintenance Manual · Revision DEMO-1 · Synthetic

---
<!-- section: 1 | page: 1 -->
## 1. Normal Operating Ranges

Under normal production the firing line should hold the following documented
bands. Readings outside these bands are flagged by the monitoring system and
should be investigated.

- Firing temperature: 60–75 °C (sensor reference band for this simulated line).
- Conveyor vibration: 0.0–3.5 mm/s RMS.
- Drive motor current: 8–14 A.

Operators should treat a single excursion as an alert and a sustained excursion
as a probable fault. Always confirm readings against a second source before
acting.

---
<!-- section: 2 | page: 2 -->
## 2. Temperature Management and Thermal Stress

The kiln temperature is the dominant driver of tile surface quality. A sustained
rise above the documented band causes thermal stress in the ceramic body. Rapid
heating or overheating promotes micro-cracks, crazing and surface defects as the
glaze and body expand at different rates.

If firing temperature rises above the normal band:

1. Verify the temperature sensor against the kiln controller set-point.
2. Check burner modulation and exhaust damper position.
3. Reduce the set-point gradually; avoid sudden cooling, which itself causes
   cracking.
4. Mark batches produced during the excursion for inspection.

A temperature change that begins shortly BEFORE defects appear is a strong
indicator that thermal stress is contributing to the defect.

---
<!-- section: 3 | page: 3 -->
## 3. Crack Defect Troubleshooting

Surface cracks and micro-cracks on fired tiles most commonly relate to thermal
history. When investigating a crack or crazing defect:

- Correlate the defect time with the firing-temperature trend in the minutes
  before the tile was inspected.
- Look for a temperature excursion above 75 °C or a steep heating ramp.
- Inspect the cooling zone for uneven airflow.
- Isolate the affected batch and route it to manual quality control.

Cracks that coincide with elevated vibration rather than temperature point
instead to mechanical handling damage (see Section 4).

---
<!-- section: 4 | page: 4 -->
## 4. Vibration and Mechanical Alignment

Excess conveyor or drive vibration can mar the tile surface and, over time,
damage bearings. Elevated vibration above 3.5 mm/s RMS indicates possible
misalignment, worn bearings, or an unbalanced roller.

Actions:

1. Inspect roller bearings and coupling alignment.
2. Check for loose mounting bolts on the drive assembly.
3. Re-balance or replace the affected roller.
4. Surface scratches or chips that track with vibration are handling damage, not
   thermal cracking.

---
<!-- section: 5 | page: 5 -->
## 5. Drive Motor Load

Drive motor current reflects mechanical load on the conveyor. A sustained rise
above 14 A suggests a conveyor jam, product pile-up, or increased friction.

Actions:

1. Inspect the conveyor path for obstructions or product pile-up.
2. Check lubrication of drive components.
3. If current spikes coincide with product deformation, stop and clear the line.
4. Persistent high current with no visible jam indicates a failing drive and
   needs maintenance.

---
<!-- section: 6 | page: 6 -->
## 6. Cooling Procedure

Controlled cooling prevents thermal-shock cracking. After any firing-temperature
excursion:

1. Lower temperature in stages, not in a single step.
2. Keep cooling-zone airflow even across the tile width.
3. Hold the batch for the documented dwell time before packing.
4. Record the excursion and the batches affected.

---
<!-- section: 7 | page: 7 -->
## 7. Safety and Human Review

The monitoring system is advisory. It highlights evidence and suggests
inspection steps; it does not control the line. Every recommended action
requires review by a qualified operator. No automated output should trigger
machine control. When evidence is uncertain, escalate to a supervisor and keep
the batch isolated until a human decision is made.
