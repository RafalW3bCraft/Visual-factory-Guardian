import {
  Component,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, AdaptiveDpr } from "@react-three/drei";
import { PerspectiveCamera, Vector3, Color } from "three";
import Machinery from "./Machinery";
import { storyState, type StoryClock } from "./director";

function CameraDirector({ clock }: { clock: RefObject<StoryClock> }) {
  const { camera, size, gl, invalidate } = useThree();
  const target = useRef(new Vector3());
  const bg = useRef(new Color());
  const warm = useRef(new Color("#F0EEE8"));
  const dark = useRef(new Color("#11191e"));
  const frames = useRef(0);
  useEffect(() => {
    const c = camera as PerspectiveCamera;
    c.setViewOffset(
      size.width,
      size.height,
      size.width < 900 ? 0 : -size.width * 0.12,
      size.width < 900
        ? -size.height * (size.width < 600 ? 0.025 : 0.07)
        : -size.height * 0.12,
      size.width,
      size.height,
    );
    c.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);
  useEffect(() => {
    const refresh = () => invalidate();
    window.addEventListener("vfg-progress", refresh);
    return () => window.removeEventListener("vfg-progress", refresh);
  }, [invalidate]);
  useFrame(({ scene }) => {
    const s = storyState(
      clock.current.progress,
      size.width < 900,
      clock.current.reduced,
    );
    target.current.set(...s.target);
    camera.position
      .set(...s.position)
      .sub(target.current)
      .multiplyScalar(1.48)
      .add(target.current);
    camera.lookAt(target.current);
    bg.current.copy(warm.current).lerp(dark.current, s.dark);
    scene.background = bg.current;
    if (++frames.current % 30 === 0) {
      gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
      gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    }
    gl.domElement.dataset.frames = String(frames.current);
    gl.domElement.dataset.chapter = String(s.chapter);
    gl.domElement.dataset.explode = s.explode.toFixed(3);
    gl.domElement.dataset.productX = s.productX.toFixed(3);
    gl.domElement.dataset.camera = camera.position
      .toArray()
      .map((n) => n.toFixed(3))
      .join(",");
  });
  return null;
}
function Simplified() {
  return (
    <div className="cinema-fallback">
      <span>SIMPLIFIED VIEW · WEBGL UNAVAILABLE</span>
      <svg
        viewBox="0 0 800 300"
        role="img"
        aria-label="Process diagram: product on a conveyor, inspection camera, thermal machine and linked sensor evidence"
      >
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M50 205H750V235H50ZM80 235V275M700 235V275M535 205V50H670V205M535 65H670M585 65V100H620V65M100 205V70H380V205" />
          {Array.from({ length: 23 }, (_, i) => (
            <circle key={i} cx={70 + i * 30} cy="220" r="8" />
          ))}
          <ellipse cx="600" cy="193" rx="35" ry="9" />
          <path
            d="M565 193V175Q600 157 635 175V193M155 130H325M155 160H325M380 130H480V105H585"
            stroke="#c65c27"
          />
        </g>
      </svg>
      <p>The full investigation remains available through the chapter text.</p>
    </div>
  );
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Simplified /> : this.props.children;
  }
}
export default function Stage({
  clock,
  reduced,
  paused,
}: {
  clock: RefObject<StoryClock>;
  reduced: boolean;
  paused: boolean;
}) {
  const [supported] = useState(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  const [lost, setLost] = useState(false),
    [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const f = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  if (!supported || lost) return <Simplified />;
  return (
    <Boundary>
      <Canvas
        aria-label="Scroll-controlled 3D industrial production cell"
        role="img"
        shadows
        dpr={[1, window.innerWidth < 900 ? 1.2 : 1.5]}
        frameloop={visible && !reduced && !paused ? "always" : "demand"}
        camera={{ position: [11, 8, 12], fov: 40, near: 0.1, far: 180 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              setLost(true);
            },
            { once: true },
          );
        }}
      >
        <ambientLight intensity={0.65} />
        <hemisphereLight args={["#eff6ff", "#6e6658", 1.5]} />
        <directionalLight
          position={[2, 10, 7]}
          intensity={3.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
          shadow-normalBias={0.035}
        />
        <directionalLight
          position={[-7, 6, -3]}
          intensity={2.5}
          color="#a8c6da"
        />
        <Environment resolution={128} frames={1}>
          <Lightformer position={[0, 7, -4]} scale={[12, 5, 1]} intensity={3} />
          <Lightformer position={[5, 3, 4]} scale={[5, 7, 1]} intensity={2} />
          <Lightformer
            position={[-5, 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[6, 4, 1]}
            intensity={2}
          />
        </Environment>
        <Machinery clock={clock} />
        <CameraDirector clock={clock} />
        <AdaptiveDpr pixelated />
      </Canvas>
    </Boundary>
  );
}
