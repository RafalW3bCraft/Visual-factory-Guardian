import { lazy, Suspense, useEffect, useState } from "react";
import Landing from "./landing/Landing";
const Demo = lazy(() => import("./App"));
const isDemo = () =>
  window.location.hash.startsWith("#/demo") ||
  window.location.hash === "#experience";

export default function Site() {
  const [demo, setDemo] = useState(isDemo);
  useEffect(() => {
    const update = () => setDemo(isDemo());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (demo) window.scrollTo(0, 0);
    else {
      const anchor = window.location.hash.slice(1);
      if (anchor)
        requestAnimationFrame(() =>
          document.getElementById(anchor)?.scrollIntoView(),
        );
      else window.scrollTo(0, 0);
    }
    document.title = demo
      ? "Guided simulation — Visual Factory Guardian"
      : "Visual Factory Guardian — See the factory differently";
  }, [demo]);
  return demo ? (
    <Suspense
      fallback={
        <div className="demo-loading" role="status">
          Opening the guided simulation…{" "}
          <a href="#factory">Return to the factory</a>
        </div>
      }
    >
      <Demo />
    </Suspense>
  ) : (
    <Landing />
  );
}
