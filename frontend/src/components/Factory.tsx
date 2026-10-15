import {
  useEffect,
  useRef,
  useState,
  memo,
  Component,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Instances, Instance } from "@react-three/drei";
import { Vector3, type Group } from "three";
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
const steel = "#87949e",
  dark = "#28343c",
  cream = "#c4c8b8",
  amber = "#edac4e";
function Box({
  p,
  s,
  c = steel,
  metal = 0.5,
  ...rest
}: {
  p: [number, number, number];
  s: [number, number, number];
  c?: string;
  metal?: number;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={p} castShadow receiveShadow {...rest}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} metalness={metal} roughness={0.55} />
    </mesh>
  );
}
function Cylinder({
  p,
  r,
  h,
  c = steel,
  rotation = [0, 0, 0],
}: {
  p: [number, number, number];
  r: number;
  h: number;
  c?: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={p} rotation={rotation} castShadow>
      <cylinderGeometry args={[r, r, h, 24]} />
      <meshStandardMaterial color={c} roughness={0.45} metalness={0.65} />
    </mesh>
  );
}
function Lamp({ p, c }: { p: [number, number, number]; c: string }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[0.075, 12, 8]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2} />
    </mesh>
  );
}
function Products({
  state,
  selected,
  onProduct,
}: Pick<Props, "state" | "selected" | "onProduct">) {
  return (
    <group>
      {inspections.map((item, i) => {
        const x = productPosition(state.time, i);
        if (x < -7 || x > 7) return null;
        const chosen = item.productId === selected;
        return (
          <group
            key={item.id}
            position={[x, 1.42, 0.3]}
            onClick={(e) => {
              e.stopPropagation();
              onProduct(item.productId);
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            <Cylinder
              p={[0, 0.08, 0]}
              r={0.33}
              h={0.15}
              c={chosen ? amber : "#a9b5bd"}
            />
            <Cylinder p={[0, 0.19, 0]} r={0.18} h={0.12} c={dark} />
            <Cylinder p={[0, 0.26, 0]} r={0.11} h={0.03} c={steel} />
            {item.flagged && (
              <Box
                p={[0.19, 0.163, 0.03]}
                s={[0.18, 0.008, 0.035]}
                c="#362723"
                rotation={[0, 0.5, 0]}
              />
            )}
            {chosen && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.44, 0.47, 40]} />
                <meshBasicMaterial color={amber} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
function Rollers({ time }: { time: number }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = time * 0.8;
  });
  return (
    <group>
      <Instances limit={46} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.12, 10]} />
        <meshStandardMaterial
          color="#525f65"
          metalness={0.65}
          roughness={0.5}
        />
        {Array.from({ length: 46 }, (_, i) => (
          <Instance
            key={i}
            position={[-6.8 + i * 0.3, 1.27, 0.3]}
            rotation={[Math.PI / 2, 0, time * 0.8]}
          />
        ))}
      </Instances>
      <group ref={ref} position={[-6.85, 1.27, 0.3]}>
        <Box p={[0, 0, 0]} s={[0.14, 0.15, 1.15]} c={amber} />
      </group>
    </group>
  );
}
const views: Record<
  Equipment,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  overview: { position: [14, 11, 17], target: [0, 1, 0] },
  conveyor: { position: [10, 7, 13], target: [0, 1, 0] },
  camera: { position: [9, 6, 10], target: [2, 1.6, 0.3] },
  temperature: { position: [4, 6, 10], target: [-3, 1.8, -0.7] },
  vibration: { position: [3, 5, 10], target: [-3.6, 1, 0.9] },
  motor: { position: [2, 4, 9], target: [-4, 1, 0.9] },
  control: { position: [10, 6, 10], target: [4, 1, 2.8] },
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
const FactoryGeometry = memo(
  function FactoryGeometry({ state, focus, onFocus }: Props) {
    const fault = state.time >= 32;
    return (
      <group>
        <Box p={[0, -0.3, 0]} s={[18, 0.55, 11.8]} c="#253039" metal={0.2} />
        <Box
          p={[0, -0.02, 0]}
          s={[17.9, 0.04, 11.7]}
          c="#3a4448"
          metal={0.05}
        />
        <gridHelper
          args={[17.8, 36, "#596269", "#454f53"]}
          position={[0, 0.01, 0]}
          scale={[1, 1, 0.65]}
        />
        {/* Back wall framing and overhead utility rails */}
        {[-7, 0, 7].map((x) => (
          <group key={x}>
            <Box p={[x, 2.6, -4.8]} s={[0.22, 5.2, 0.22]} c="#53616b" />
            <Box p={[x, 0.12, -4.8]} s={[0.6, 0.18, 0.6]} c={dark} />
            <Box p={[x, 5.15, -2]} s={[0.13, 0.18, 5.7]} c="#65717a" />
            <Box p={[x, 4.99, -2]} s={[0.08, 0.06, 3.2]} c="#b5c8ca" />
          </group>
        ))}
        <Box p={[0, 5.05, -4.8]} s={[14.4, 0.3, 0.24]} c="#53616b" />
        <Box p={[0, 0.55, -4.8]} s={[14, 0.9, 0.12]} c="#313d45" />
        <Box p={[-1, 4.55, -4.75]} s={[11, 0.07, 0.08]} c={amber} />
        {/* Safety aisle and cell boundary */}
        {[-1.45, 2.05].map((z) => (
          <Box key={z} p={[0, 0.035, z]} s={[14.6, 0.015, 0.07]} c={amber} />
        ))}
        {[-7.3, 7.3].map((x) => (
          <Box key={x} p={[x, 0.035, 0.3]} s={[0.07, 0.015, 3.55]} c={amber} />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <Box
            key={i}
            p={[-6.5 + i * 0.9, 0.045, 2.65]}
            s={[0.45, 0.015, 0.07]}
            c="#849092"
          />
        ))}
        {/* Rubber conveyor and frame */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onFocus("conveyor");
          }}
        >
          <Box p={[0, 1.13, 0.3]} s={[14.4, 0.2, 1.55]} c={dark} />
          {[-0.44, 1.04].map((z) => (
            <Box key={z} p={[0, 1.39, z]} s={[14.4, 0.13, 0.12]} c={steel} />
          ))}
          {[-6, -3, 0, 3, 6].map((x) => (
            <group key={x}>
              {[-0.3, 0.9].map((z) => (
                <Box key={z} p={[x, 0.56, z]} s={[0.13, 1.1, 0.13]} c={steel} />
              ))}
              <Box p={[x, 0.25, 0.3]} s={[0.16, 0.1, 1.4]} c={dark} />
            </group>
          ))}
        </group>
        {/* Thermal processing cell: housing, access panel, vents and cable conduit */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onFocus("temperature");
          }}
        >
          <Box p={[-3.7, 1.5, -1.65]} s={[3.4, 2.9, 2.25]} c={cream} />
          <Box p={[-3.7, 0.15, -1.65]} s={[3.6, 0.3, 2.4]} c={dark} />
          <Box p={[-3.7, 2.8, -1.65]} s={[3.5, 0.2, 2.35]} c={steel} />
          <Box p={[-3.7, 1.75, -0.505]} s={[2.9, 1.8, 0.06]} c="#4d5d64" />
          <Box p={[-3.7, 1.78, -0.46]} s={[2.5, 1.45, 0.05]} c="#202d34" />
          <Box p={[-3.7, 1.8, -0.41]} s={[0.07, 1.5, 0.04]} c={steel} />
          <Box p={[-2.65, 1.8, -0.39]} s={[0.035, 0.32, 0.08]} c={amber} />
          {Array.from({ length: 7 }, (_, i) => (
            <Box
              key={i}
              p={[-5.42, 0.9 + i * 0.15, -1.7]}
              s={[0.035, 0.04, 1.3]}
              c={dark}
            />
          ))}
          <Cylinder p={[-4.5, 3.2, -1.7]} r={0.23} h={0.6} c={steel} />
          <Cylinder p={[-4.5, 3.52, -1.7]} r={0.32} h={0.1} c={dark} />
          <Box p={[-2.7, 3.14, -1.7]} s={[0.5, 0.48, 0.5]} c={dark} />
          <Lamp p={[-2.7, 3.42, -1.7]} c={fault ? "#ffb347" : "#45d69a"} />
          <mesh position={[-2.08, 2.1, -0.4]}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial
              color="#42c8e8"
              emissive="#42c8e8"
              emissiveIntensity={focus === "temperature" ? 3 : 0.6}
            />
          </mesh>
        </group>
        {/* Drive motor */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onFocus("motor");
          }}
        >
          <Box p={[-4.7, 0.5, 1.6]} s={[1.7, 0.25, 0.7]} c={dark} />
          <Cylinder
            p={[-4.7, 0.85, 1.6]}
            r={0.32}
            h={1.3}
            c="#628489"
            rotation={[0, 0, Math.PI / 2]}
          />
          {Array.from({ length: 8 }, (_, i) => (
            <Cylinder
              key={i}
              p={[-5.15 + i * 0.13, 0.85, 1.6]}
              r={0.35}
              h={0.035}
              c={dark}
              rotation={[0, 0, Math.PI / 2]}
            />
          ))}
          <Cylinder
            p={[-3.9, 0.85, 1.6]}
            r={0.14}
            h={0.3}
            c={steel}
            rotation={[0, 0, Math.PI / 2]}
          />
          <Box p={[-4.7, 1.22, 1.6]} s={[0.4, 0.2, 0.3]} c={dark} />
          <Lamp p={[-4.4, 1.35, 1.6]} c="#42c8e8" />
        </group>
        {/* Vision gantry and camera */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onFocus("camera");
          }}
        >
          {[-0.8, 1.4].map((z) => (
            <group key={z}>
              <Box p={[2, 1.6, z]} s={[0.15, 3.2, 0.15]} c={steel} />
              <Box p={[2, 0.1, z]} s={[0.45, 0.15, 0.45]} c={dark} />
            </group>
          ))}
          <Box p={[2, 3.18, 0.3]} s={[0.3, 0.2, 2.35]} c={steel} />
          <Box p={[2, 2.88, 0.3]} s={[0.7, 0.5, 0.6]} c={dark} />
          <Cylinder p={[2, 2.56, 0.3]} r={0.19} h={0.2} c="#101c22" />
          <Cylinder p={[2, 2.44, 0.3]} r={0.13} h={0.04} c="#42c8e8" />
          <Box p={[2, 1.425, 0.3]} s={[1.35, 0.014, 1.2]} c="#315158" />
          <mesh position={[2, 1.44, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.035, 1.2]} />
            <meshBasicMaterial color="#42c8e8" transparent opacity={0.8} />
          </mesh>
          <Lamp
            p={[2.38, 3, 0.3]}
            c={state.time >= 32 ? "#ffb347" : "#45d69a"}
          />
        </group>
        {/* Control cabinet and operator terminal */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onFocus("control");
          }}
        >
          <Box p={[5.3, 1.1, -2.7]} s={[1.55, 2.2, 0.75]} c={cream} />
          <Box p={[5.3, 1.15, -2.3]} s={[1.35, 1.85, 0.035]} c="#7e8d8d" />
          <Box p={[5.8, 1.1, -2.25]} s={[0.035, 0.3, 0.04]} c={dark} />
          {Array.from({ length: 4 }, (_, i) => (
            <Box
              key={i}
              p={[5.1, 0.45 + i * 0.13, -2.25]}
              s={[0.65, 0.03, 0.015]}
              c={dark}
            />
          ))}
          <Lamp p={[5.6, 1.9, -2.2]} c="#45d69a" />
          <Box p={[4.6, 0.65, 3.15]} s={[0.12, 1.3, 0.12]} c={steel} />
          <Box p={[4.6, 0.08, 3.15]} s={[0.8, 0.13, 0.6]} c={dark} />
          <Box
            p={[4.6, 1.55, 3.15]}
            s={[1.2, 0.8, 0.14]}
            c={dark}
            rotation={[-0.12, 0, 0]}
          />
          <Box
            p={[4.6, 1.56, 3.24]}
            s={[1.04, 0.62, 0.02]}
            c="#153e48"
            rotation={[-0.12, 0, 0]}
          />
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              p={[4.35 + i * 0.24, 1.5 + i * 0.05, 3.29]}
              s={[0.12, 0.2 + i * 0.06, 0.01]}
              c="#42c8e8"
            />
          ))}
          <Box p={[4.6, 1.08, 3.4]} s={[1.2, 0.08, 0.7]} c={steel} />
        </group>
        {/* Finished components, pallet and safety fence */}
        <Box p={[7.4, 0.15, 3.6]} s={[1.5, 0.25, 1.5]} c="#806446" />
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            p={[7.4, 0.32 + i * 0.35, 3.6]}
            s={[1.2, 0.32, 1.2]}
            c={i === 2 ? "#929e99" : "#667471"}
          />
        ))}
        {[1, 2.8, 4.6, 6.4].map((x) => (
          <group key={x}>
            <Box p={[x, 1, -3.9]} s={[0.07, 2, 0.07]} c={amber} />
            <Box p={[x + 0.85, 1.85, -3.9]} s={[1.75, 0.06, 0.05]} c={amber} />
            <Box p={[x + 0.85, 0.25, -3.9]} s={[1.75, 0.06, 0.05]} c={amber} />
            {[0, 1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                p={[x + 0.2 + i * 0.33, 1.05, -3.9]}
                s={[0.016, 1.55, 0.016]}
                c="#7c8780"
              />
            ))}
          </group>
        ))}
      </group>
    );
  },
  (a, b) => a.focus === b.focus && a.state.time >= 32 === b.state.time >= 32,
);
const pins: {
  p: [number, number, number];
  label: string;
  equipment: Equipment;
}[] = [
  { p: [-3.7, 3.9, -1.2], label: "Thermal cell", equipment: "temperature" },
  { p: [2, 3.8, 0.3], label: "Vision station", equipment: "camera" },
  { p: [-4.8, 1.6, 2], label: "Drive motor", equipment: "motor" },
  { p: [5.2, 2.4, 3], label: "Control station", equipment: "control" },
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
    const productX = productPosition(state.time, Math.max(0, index));
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
          ? Math.abs(productX) < 7
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
          frameloop={props.visible && !props.reduced ? "always" : "demand"}
          camera={{ position: [14, 11, 17], fov: 42, near: 0.1, far: 90 }}
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
          <ambientLight intensity={1.5} />
          <hemisphereLight args={["#b8d2e0", "#57605a", 2]} />
          <directionalLight
            position={[4, 12, 8]}
            intensity={3.8}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
            shadow-bias={-0.001}
          />
          <directionalLight
            position={[-8, 6, -4]}
            color="#e8b87b"
            intensity={2.4}
          />
          <pointLight
            position={[2, 3.4, 0.3]}
            color="#8be8f4"
            intensity={10}
            distance={6}
          />
          <FactoryGeometry {...props} />
          <Rollers time={props.state.time} />
          <Products
            state={props.state}
            selected={props.selected}
            onProduct={props.onProduct}
          />
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
