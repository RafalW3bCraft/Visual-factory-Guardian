import { lazy, Suspense, useEffect, useState } from "react";
import Landing from "./cinematic/Landing";
const Console = lazy(() => import("./App"));
function isDemo() {
  return (
    location.pathname.replace(/\/$/, "") === "/dashboard" ||
    /^#\/(demo|console)/.test(location.hash) ||
    location.hash === "#experience"
  );
}
export default function Site() {
  const [demo, setDemo] = useState(isDemo);
  useEffect(() => {
    const update = () => setDemo(isDemo());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.body.dataset.view = demo ? "demo" : "story";
    if (demo || !location.hash.startsWith("#chapter-")) window.scrollTo(0, 0);
    document.title = `${demo ? "Operator investigation" : "See the defect. Understand the signals."} — Visual Factory Guardian`;
  }, [demo]);
  return demo ? (
    <Suspense
      fallback={<div className="demo-loading">Opening investigation…</div>}
    >
      <Console />
    </Suspense>
  ) : (
    <Landing />
  );
}
