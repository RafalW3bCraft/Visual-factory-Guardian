import { Photograph } from "./Photograph";
import { InspectionOverlay } from "./InspectionOverlay";
import { sensorSnapshot } from "./content";

export function ScrollStory() {
  return (
    <div className="film-sequence">
      <div className="film-sequence-stage">
        <div className="film-camera">
          <Photograph scene="motor" />
          <InspectionOverlay />
        </div>
        <div className="film-sequence-shade" />
        <span className="film-scene-caption">
          ENGINEERED TO LOOK CLOSER{" "}
          <span>GENERATED INDUSTRIAL ILLUSTRATION</span>
        </span>
      </div>
      <div className="film-sequence-chapters">
        <section
          id="signals"
          className="film-chapter film-signals"
          data-chapter
          aria-labelledby="signals-title"
        >
          <Photograph scene="motor" className="film-static-photo" />
          <div className="film-copy">
            <p className="film-kicker">02 / THE INVISIBLE PROBLEM</p>
            <h2 id="signals-title">
              Problems don’t
              <br />
              always announce
              <br />
              <em>themselves.</em>
            </h2>
            <p className="film-body">
              A change in a surface. A shift in temperature. Small signals can
              be easy to miss in a system that never stands still.
            </p>
            <p className="film-technical">
              <span className="film-rule" />
              SUBTLE SIGNALS. COMPLEX SYSTEMS.
            </p>
          </div>
          <p className="film-mobile-observation">
            Inspection focus / drive coupling
            <br />
            Illustrative scenario · requires inspection
          </p>
        </section>
        <section
          id="vision"
          className="film-chapter film-vision"
          data-chapter
          aria-labelledby="vision-title"
        >
          <Photograph scene="motor" className="film-static-photo" />
          <div className="film-copy">
            <p className="film-kicker">03 / MACHINE VISION</p>
            <h2 id="vision-title">
              What humans see.
              <br />
              What machines
              <br />
              <em>notice.</em>
            </h2>
            <p className="film-body">
              Turn visual observations into structured inspection signals. Then
              give an engineer the context to investigate.
            </p>
            <p className="film-disclosure">
              Illustrative inspection overlay. No model has analyzed this
              generated photograph.
            </p>
          </div>
          <div className="film-vision-note">
            <span className="film-dot" />
            POTENTIAL ANOMALY<span>Observation, not a diagnosis.</span>
          </div>
        </section>
        <section
          id="context"
          className="film-chapter film-context"
          data-chapter
          aria-labelledby="context-title"
        >
          <Photograph scene="motor" className="film-static-photo" />
          <div className="film-copy">
            <p className="film-kicker">04 / BEYOND THE IMAGE</p>
            <h2 id="context-title">
              One signal is
              <br />
              never the
              <br />
              <em>whole story.</em>
            </h2>
            <p className="film-body">
              Connect visual evidence with operational context. See what changed
              around an inspection event.
            </p>
            <dl className="film-readings">
              {sensorSnapshot.readings.map((sensor) => (
                <div key={sensor.key}>
                  <dt>{sensor.label}</dt>
                  <dd>
                    {sensor.value}
                    <small> {sensor.unit}</small>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="film-disclosure">
              Simulated snapshot · {sensorSnapshot.scenario} · T+
              {sensorSnapshot.seconds}s. Values from the working demo, not the
              pictured equipment.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
