import {
  useEffect,
  useRef,
  useState,
  Component,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import Lighting from "../cinematic/Lighting";
import Machinery from "../cinematic/Machinery";
import { IndustrialFinish, MachinedFlange } from "../cinematic/Hardware";
import type { StoryClock } from "../cinematic/director";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  inspections,
  productPosition,
  type Equipment,
  type Simulation,
} from "../simulation/engine";

type Props = {
  state: Simulation;
  focus: Equipment;
  cameraKey: number;
  selected: string;
  onFocus: (e: Equipment) => void;
  onProduct: (id: string) => void;
  reduced: boolean;
  visible: boolean;
};
function Products({
  state,
  selected,
  onProduct,
}: Pick<Props, "state" | "selected" | "onProduct">) {
  return (
    <group>
      {inspections.map((item, i) => {
        const x = productPosition(state.time, i) - 0.35;
        if (x < -5.5 || x > 5.5) return null;
        const chosen = item.productId === selected;
        return (
          <group
            key={item.id}
            position={[x, 1.34, 0.35]}
            onClick={(e) => {
              e.stopPropagation();
              onProduct(item.productId);
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            <MachinedFlange defect={item.flagged} />
            {chosen && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.44, 0.47, 40]} />
                <meshBasicMaterial color="#edac4e" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
const views: Record<
  Equipment,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  overview: { position: [11, 8, 13], target: [0, 1, 0] },
  conveyor: { position: [10, 7, 13], target: [0, 1, 0] },
  camera: { position: [9, 6, 10], target: [2, 1.6, 0.3] },
  temperature: { position: [3, 5, 7], target: [-2.7, 1.8, -1.25] },
  vibration: { position: [0, 4, 6], target: [-4.6, 1, -1.05] },
  motor: { position: [0, 4, 6], target: [-4.6, 1, -1.05] },
  control: { position: [10, 6, 10], target: [4.6, 1.1, -1.6] },
};
function Director({
  focus,
  cameraKey,
  reduced,
}: {
  focus: Equipment;
  cameraKey: number;
  reduced: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const moving = useRef(true);
  const target = useRef(new Vector3());
  const destination = useRef(new Vector3());
  useEffect(() => {
    target.current.set(...views[focus].target);
    destination.current.set(...views[focus].position);
    if (size.width < 600) {
      destination.current
        .sub(target.current)
        .multiplyScalar(1.45)
        .add(target.current);
    }
    moving.current = true;
    invalidate();
  }, [focus, cameraKey, invalidate, size.width]);
  useFrame((_, delta) => {
    if (!controls.current || !moving.current) return;
    const alpha = reduced ? 1 : 1 - Math.exp(-delta * 4);
    camera.position.lerp(destination.current, alpha);
    controls.current.target.lerp(target.current, alpha);
    controls.current.update();
    if (camera.position.distanceTo(destination.current) < 0.02) {
      moving.current = false;
    } else invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={5}
      maxDistance={42}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2.25}
      onStart={() => (moving.current = false)}
      enableDamping
      dampingFactor={0.08}
    />
  );
}
const pins: {
  p: [number, number, number];
  label: string;
  equipment: Equipment;
}[] = [
  { p: [-2.7, 3.35, -1.25], label: "Thermal cell", equipment: "temperature" },
  { p: [1.65, 3.85, 0.35], label: "Vision station", equipment: "camera" },
  { p: [-4.65, 1.5, -1.05], label: "Drive motor", equipment: "motor" },
  { p: [4.6, 2.3, -1.6], label: "Control station", equipment: "control" },
];
function ProjectLabels({
  elements,
  state,
  selected,
  focus,
}: {
  elements: RefObject<(HTMLElement | null)[]>;
  state: Simulation;
  selected: string;
  focus: Equipment;
}) {
  const point = useRef(new Vector3());
  const { camera, size } = useThree();
  useFrame(() => {
    const index = inspections.findIndex((e) => e.productId === selected);
    const productX = productPosition(state.time, Math.max(0, index)) - 0.35;
    const positions = [
      ...pins.map((p) => p.p),
      [productX, 2.2, 0.3] as [number, number, number],
    ];
    positions.forEach((p, i) => {
      const el = elements.current[i];
      if (!el) return;
      point.current.set(...p).project(camera);
      const x = ((point.current.x + 1) / 2) * size.width,
        y = ((-point.current.y + 1) / 2) * size.height;
      const shown =
        point.current.z < 1 &&
        x > 45 &&
        x < size.width - 45 &&
        y > 45 &&
        y < size.height - 90 &&
        (i === 4
          ? Math.abs(productX) < 5.5
          : focus === "overview" ||
            focus === "conveyor" ||
            pins[i].equipment === focus ||
            (focus === "vibration" && i === 2));
      el.style.visibility = shown ? "visible" : "hidden";
      el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    });
  });
  return null;
}
function Fallback() {
  return (
    <div className="webgl-fallback">
      <span className="eyebrow">SIMPLIFIED VISUALIZATION</span>
      <h3>Production line 01</h3>
      <div className="fallback-flow">
        Thermal cell → Conveyor → Vision station → Review
      </div>
      <p>
        WebGL is unavailable. All inspection evidence, telemetry and
        presentation controls remain accessible below.
      </p>
    </div>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
export default function Factory(props: Props) {
  const [supported] = useState(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  const [lost, setLost] = useState(false);
  const clock = useRef<StoryClock>({
    progress: 0,
    reduced: props.reduced,
    paused: true,
  });
  const elements = useRef<(HTMLElement | null)[]>([]);
  if (!supported || lost) return <Fallback />;
  return (
    <SceneBoundary>
      <div className="webgl-scene">
        <Canvas
          role="img"
          aria-label="Interactive 3D production line"
          shadows
          dpr={[1, 1.5]}
          frameloop={
            props.visible && !props.reduced && props.state.status === "playing"
              ? "always"
              : "demand"
          }
          camera={{ position: [11, 8, 13], fov: 42, near: 0.1, far: 90 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener(
              "webglcontextlost",
              () => setLost(true),
              { once: true },
            );
          }}
        >
          <color attach="background" args={["#101820"]} />
          <fog attach="fog" args={["#101820", 28, 65]} />
          <Lighting />
          <Machinery
            clock={clock}
            consoleTime={props.state.time}
            onFocus={props.onFocus}
          />
          <IndustrialFinish>
            <Products
              state={props.state}
              selected={props.selected}
              onProduct={props.onProduct}
            />
          </IndustrialFinish>
          <ProjectLabels
            elements={elements}
            state={props.state}
            selected={props.selected}
            focus={props.focus}
          />
          <Director
            focus={props.focus}
            cameraKey={props.cameraKey}
            reduced={props.reduced}
          />
        </Canvas>
        <div className="factory-labels">
          {pins.map((pin, i) => (
            <button
              key={pin.label}
              ref={(el) => {
                elements.current[i] = el;
              }}
              className={`scene-pin ${props.focus === pin.equipment ? "selected" : ""}`}
              aria-label={`Focus ${pin.label}`}
              onClick={() => props.onFocus(pin.equipment)}
            >
              <span />
              {pin.label}
            </button>
          ))}
          <span
            ref={(el) => {
              elements.current[4] = el;
            }}
            className="product-label"
          >
            {props.selected}
          </span>
        </div>
      </div>
    </SceneBoundary>
  );
}
