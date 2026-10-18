import { useEffect, type RefObject } from "react";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** One scheduler, cached layout, no React renders during scroll. */
export function useCinematicScroll(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = matchMedia("(max-width: 767px)");
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-chapter]"),
    );
    const links = Array.from(
      root.querySelectorAll<HTMLAnchorElement>("[data-chapter-link]"),
    );
    const sequence = root.querySelector<HTMLElement>(".film-sequence")!;
    let tops: number[] = [],
      sequenceTop = 0,
      sequenceHeight = 1,
      viewport = innerHeight;
    let frame = 0;
    let active = -1;
    const paint = () => {
      frame = 0;
      const y = window.scrollY;
      const still = motion.matches || mobile.matches;
      const progress = clamp(
        (y - sequenceTop) / Math.max(1, sequenceHeight - viewport),
      );
      root.style.setProperty(
        "--hero-shift",
        `${still ? 0 : Math.min(y, viewport) * 0.18}px`,
      );
      root.style.setProperty(
        "--hero-scale",
        `${still ? 1 : 1 + clamp(y / viewport) * 0.05}`,
      );
      root.style.setProperty(
        "--camera-scale",
        `${still ? 1 : 1 + progress * 0.12}`,
      );
      root.style.setProperty(
        "--frame-opacity",
        `${still ? 1 : clamp((progress - 0.22) / 0.13)}`,
      );
      root.style.setProperty(
        "--observation-opacity",
        `${still ? 1 : clamp((progress - 0.4) / 0.12)}`,
      );
      root.style.setProperty(
        "--sensor-opacity",
        `${still ? 1 : clamp((progress - 0.7) / 0.12)}`,
      );
      const evidenceProgress = clamp(
        (y + viewport * 0.65 - tops[4]) / (viewport * 0.7),
      );
      root
        .querySelectorAll<HTMLElement>("[data-evidence]")
        .forEach((element, index) => {
          element.style.setProperty(
            "--evidence-opacity",
            `${still ? 1 : 0.2 + 0.8 * clamp(evidenceProgress * 3 - index * 0.6)}`,
          );
        });
      let next = 0;
      tops.forEach((top, i) => {
        if (y + viewport * 0.45 >= top) next = i;
      });
      if (next !== active) {
        active = next;
        links.forEach((link) => {
          if (Number(link.dataset.chapterLink) === active)
            link.setAttribute("aria-current", "step");
          else link.removeAttribute("aria-current");
        });
        const counter = root.querySelector("[data-chapter-count]");
        if (counter) counter.textContent = String(active + 1).padStart(2, "0");
      }
      root.dataset.scrolled = String(y > 40);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const measure = () => {
      viewport = innerHeight;
      tops = sections.map(
        (section) => section.getBoundingClientRect().top + scrollY,
      );
      sequenceTop = sequence.getBoundingClientRect().top + scrollY;
      sequenceHeight = sequence.offsetHeight;
      schedule();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    motion.addEventListener("change", measure);
    mobile.addEventListener("change", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      motion.removeEventListener("change", measure);
      mobile.removeEventListener("change", measure);
    };
  }, [rootRef]);
}
