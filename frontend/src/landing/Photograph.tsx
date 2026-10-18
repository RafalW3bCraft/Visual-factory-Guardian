import { useState, type CSSProperties } from "react";
import { photographs } from "./content";

export function Photograph({
  scene,
  priority = false,
  className = "",
}: {
  scene: keyof typeof photographs;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const asset = photographs[scene];
  return (
    <div
      className={`film-photograph ${className}`}
      style={{ "--focal-point": asset.position } as CSSProperties}
    >
      <picture>
        <source
          media="(max-width: 600px)"
          srcSet={`/images/${asset.name}-mobile.webp`}
        />
        <img
          src={`/images/${asset.name}-1600.webp`}
          srcSet={`/images/${asset.name}-960.webp 960w, /images/${asset.name}-1600.webp 1600w`}
          sizes="100vw"
          width={scene === "factory" ? 1600 : 1536}
          height={scene === "factory" ? 800 : 1024}
          alt={asset.alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
          style={failed ? { visibility: "hidden" } : undefined}
        />
      </picture>
      {failed && (
        <span className="film-media-fallback">
          Factory illustration unavailable. The story continues below.
        </span>
      )}
    </div>
  );
}
