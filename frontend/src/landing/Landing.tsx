import { useRef } from "react";
import { chapters, sensorSnapshot } from "./content";
import { Photograph } from "./Photograph";
import { ScrollStory } from "./ScrollStory";
import { useCinematicScroll } from "./useCinematicScroll";
import "./landing.css";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function Navigation() {
  return (
    <header className="film-header">
      <a
        className="film-brand"
        href="#factory"
        aria-label="Visual Factory Guardian home"
      >
        <span className="film-brand-mark" aria-hidden="true">
          V<span>G</span>
        </span>
        <span>
          VISUAL FACTORY
          <br />
          GUARDIAN<span className="film-brand-period">.</span>
        </span>
      </a>
      <nav className="film-main-nav" aria-label="Main navigation">
        <a href="#vision">Technology</a>
        <a href="#signals">Experience</a>
        <a href="#understanding">How it works</a>
      </nav>
      <a className="film-demo-link" href="#/demo">
        Open demo <Arrow />
      </a>
    </header>
  );
}

function CinematicHero() {
  return (
    <section
      id="factory"
      data-chapter
      className="film-hero"
      aria-labelledby="factory-title"
    >
      <div className="film-hero-image">
        <Photograph scene="factory" priority />
      </div>
      <div className="film-hero-shade" />
      <div className="film-hero-content">
        <p className="film-kicker">
          <span className="film-dot" />
          INDUSTRIAL INTELLIGENCE / A NEW PERSPECTIVE
        </p>
        <h1 id="factory-title">
          The factory
          <br />
          never stops.
        </h1>
        <p className="film-hero-follow">Neither do we.</p>
        <div className="film-hero-bottom">
          <p>
            Industrial intelligence powered
            <br />
            by vision, sensors and AI.
            <span className="film-prototype">
              A hackathon prototype. An engineer’s perspective.
            </span>
          </p>
          <a className="film-explore" href="#signals">
            <span className="film-circle" aria-hidden="true">
              ↓
            </span>
            <span>
              Explore the experience<small>SCROLL TO ENTER THE FACTORY</small>
            </span>
          </a>
        </div>
      </div>
      <div className="film-hero-foot">
        <span>VISION. CONTEXT. UNDERSTANDING.</span>
        <span>
          01 — 06 <span className="film-amber">↓</span>
        </span>
      </div>
    </section>
  );
}

function Investigation() {
  return (
    <section
      id="understanding"
      data-chapter
      className="film-investigation"
      aria-labelledby="understanding-title"
    >
      <div className="film-investigation-image">
        <Photograph scene="motor" />
        <span className="film-image-caption">
          A CLOSER LOOK CHANGES THE QUESTION.
        </span>
      </div>
      <div className="film-investigation-copy">
        <p className="film-kicker">05 / FROM SIGNAL TO EXPLANATION</p>
        <h2 id="understanding-title">
          From observation
          <br />
          to <em>understanding.</em>
        </h2>
        <p className="film-body">
          Complex signals. Traceable evidence.
          <br />
          An engineer makes the call.
        </p>
        <ol className="film-evidence">
          <li data-evidence>
            <span>01</span>
            <div>
              <h3>Observe the irregularity.</h3>
              <p>
                Product P-004 is flagged in the synthetic inspection scenario.
                It is a prompt to investigate.
              </p>
            </div>
          </li>
          <li data-evidence>
            <span>02</span>
            <div>
              <h3>Follow the evidence.</h3>
              <p>
                Injected temperature drift begins {sensorSnapshot.lead} seconds
                before the fixture’s visual event. Timing provides context, not
                proof of cause.
              </p>
            </div>
          </li>
          <li data-evidence>
            <span>03</span>
            <div>
              <h3>Keep the engineer in control.</h3>
              <p>
                Review thermal process instability as a candidate explanation.
                Inspect and verify before drawing a conclusion.
              </p>
            </div>
          </li>
        </ol>
        <p className="film-disclosure">
          Current demo: deterministic evidence and explanations.
          <br />
          LLM-assisted interpretation and manual retrieval remain planned.
        </p>
        <a className="film-text-link" href="#/demo">
          Investigate the scenario <Arrow />
        </a>
      </div>
    </section>
  );
}

function FinalExperience() {
  return (
    <section
      id="next"
      data-chapter
      className="film-final"
      aria-labelledby="next-title"
    >
      <Photograph scene="factory" />
      <div className="film-final-shade" />
      <div className="film-final-copy">
        <p className="film-kicker">06 / THE COMPLETE PICTURE</p>
        <h2 id="next-title">
          See the factory
          <br />
          <em>differently.</em>
        </h2>
        <p className="film-body">
          Industrial vision. Operational signals. Engineering context.
          <br />
          Explore how they come together.
        </p>
        <div className="film-final-actions">
          <a className="film-launch" href="#/demo">
            Launch the demo <Arrow />
          </a>
          <a className="film-text-link" href="#vision">
            Explore the technology <Arrow />
          </a>
        </div>
        <p className="film-disclosure">
          Guided simulation · no account or connected hardware required
        </p>
      </div>
    </section>
  );
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useCinematicScroll(root);
  return (
    <div className="film" ref={root}>
      <a href="#signals" className="film-skip">
        Skip to the experience
      </a>
      <Navigation />
      <main>
        <CinematicHero />
        <ScrollStory />
        <Investigation />
        <FinalExperience />
      </main>
      <aside className="film-chapter-rail" aria-label="Experience progress">
        <span>
          <b data-chapter-count>01</b> / 06
        </span>
        <nav aria-label="Experience chapters">
          {chapters.map((chapter, index) => (
            <a
              href={`#${chapter.id}`}
              key={chapter.id}
              data-chapter-link={index}
              aria-label={`${String(index + 1).padStart(2, "0")} ${chapter.label}`}
              aria-current={index === 0 ? "step" : undefined}
            >
              <span>{chapter.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <footer className="film-footer">
        <a href="#factory" className="film-footer-brand">
          VISUAL FACTORY GUARDIAN<span>Engineered for a closer look.</span>
        </a>
        <p>
          Hackathon prototype / 2026
          <br />
          AI-generated imagery. Illustrative inspections. Synthetic telemetry.
        </p>
        <a
          className="film-text-link"
          href="https://github.com/RafalW3bCraft/Visual-factory-Guardian"
          target="_blank"
          rel="noreferrer"
        >
          Explore the source <Arrow />
        </a>
      </footer>
    </div>
  );
}
