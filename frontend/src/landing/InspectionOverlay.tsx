import { sensorSnapshot } from "./content";

export function InspectionOverlay() {
  return (
    <div className="film-inspection" aria-hidden="true">
      <div className="film-focus-frame">
        <i />
        <i />
        <i />
        <i />
        <span>01 / INSPECTION FOCUS</span>
      </div>
      <div className="film-observation">
        <span className="film-dot" />
        Potential anomaly<span>Illustrative marker · requires inspection</span>
      </div>
      <div className="film-sensor-labels">
        {sensorSnapshot.readings.slice(0, 2).map((sensor) => (
          <div
            key={sensor.key}
            className={`film-sensor film-sensor-${sensor.key}`}
          >
            <span>{sensor.label}</span>
            <strong>
              {sensor.value}
              <small> {sensor.unit}</small>
            </strong>
            <span>SIMULATED / T+32s</span>
          </div>
        ))}
      </div>
    </div>
  );
}
