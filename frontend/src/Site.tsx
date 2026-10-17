import { lazy, Suspense, useEffect, useState } from "react";
import { FactoryStory, InteractiveDemo } from "./experience/Experience";
const Console = lazy(() => import("./App"));
function route() {
  return location.hash.startsWith("#/console") ||
    location.hash === "#experience"
    ? "console"
    : location.hash.startsWith("#/demo")
      ? "demo"
      : "story";
}
export default function Site() {
  const [page, setPage] = useState(route);
  useEffect(() => {
    const change = () => setPage(route());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${page === "story" ? "Industrial intelligence in action" : page === "demo" ? "Interactive manufacturing demo" : "Simulation & backend console"} — Visual Factory Guardian`;
  }, [page]);
  return page === "console" ? (
    <Suspense
      fallback={<div className="demo-loading">Opening simulation console…</div>}
    >
      <Console />
    </Suspense>
  ) : page === "demo" ? (
    <InteractiveDemo />
  ) : (
    <FactoryStory />
  );
}
