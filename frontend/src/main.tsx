import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Site from "./Site";
import "./base.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Site />
const dashboard = window.location.pathname.replace(/\/$/, "") === "/dashboard";
const Experience = dashboard
  ? lazy(async () => {
      await import("./styles.css");
      return import("./App");
    })
  : lazy(() => import("./cinematic/Landing"));
// The operator application keeps its own styles and state, isolated from the film.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <p style={{ padding: 32, fontFamily: "sans-serif" }}>
          Loading Visual Factory Guardian…
        </p>
      }
    >
      <Experience />
    </Suspense>
  </React.StrictMode>,
);
