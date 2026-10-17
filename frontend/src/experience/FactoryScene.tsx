import {
  Component,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  type RefObject,
  type ReactNode,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { RoundedBox, Line } from "@react-three/drei";
import {
  Vector3,
  Quaternion,
  Shape,
  PMREMGenerator,
  CanvasTexture,
  RepeatWrapping,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { frameAt, shoulder, crack, type Frame, type Vec } from "./timeline";

const orange = "#d97b35",
  steel = "#a1b1b7",
  dark = "#222e35";
function Block({
  p,
  s,
  c = steel,
  radius = 0.025,
}: {
  p: Vec;
  s: Vec;
  c?: string;
  radius?: number;
}) {
  return (
    <RoundedBox
      position={p}
      args={s}
      radius={radius}
      smoothness={2}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={c} metalness={0.65} roughness={0.35} />
    </RoundedBox>
  );
}
function Cylinder({
  p,
  r,
  h,
  c = steel,
  rotation = [0, 0, 0],
}: {
  p: Vec;
  r: number;
  h: number;
  c?: string;
  rotation?: Vec;
}) {
  return (
    <mesh position={p} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 40]} />
      <meshStandardMaterial color={c} metalness={0.8} roughness={0.28} />
    </mesh>
  );
}
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl),
      room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.65;
    return () => {
      scene.environment = null;
      target.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene]);
  return null;
}
function Camera({
  frame,
  reduced,
  focus,
}: {
  frame: Frame;
  reduced: boolean;
  focus?: string;
}) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    let position = reduced ? frameAt(0).camera : frame.camera;
    let target = reduced ? frameAt(0).target : frame.target;
    if (focus === "robot") {
      position = [1.2, 4.2, 7];
      target = [-2.7, 1.9, 0.5];
    }
    if (focus === "camera") {
      position = [5, 4.3, 5];
      target = [2, 1.7, 0];
    }
    if (focus === "motor") {
      position = [4.5, 3.1, 4];
      target = [0.3, 0.9, 0.9];
    }
    const t = new Vector3(...target),
      p = new Vector3(...position);
    if (size.width / size.height < 1) p.sub(t).multiplyScalar(1.15).add(t);
    camera.position.copy(p);
    camera.lookAt(t);
    camera.updateMatrixWorld();
    invalidate();
  }, [frame, reduced, focus, camera, invalidate, size.width, size.height]);
  return null;
}
function Link({
  a,
  b,
  width,
  color,
}: {
  a: Vec;
  b: Vec;
  width: number;
  color: string;
}) {
  const start = new Vector3(...a),
    end = new Vector3(...b),
    length = Math.round(start.distanceTo(end) * 1e8) / 1e8;
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    end.clone().sub(start).normalize(),
  );
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(-width * 0.48, 0);
    s.lineTo(-width * 0.6, length * 0.18);
    s.lineTo(-width * 0.32, length * 0.94);
    s.quadraticCurveTo(0, length + 0.09, width * 0.32, length * 0.94);
    s.lineTo(width * 0.6, length * 0.18);
    s.lineTo(width * 0.48, 0);
    s.closePath();
    return s;
  }, [length, width]);
  const extrusion = useMemo(
    () => ({
      depth: width * 0.64,
      bevelEnabled: true,
      bevelSize: 0.055,
      bevelThickness: 0.04,
      bevelSegments: 3,
      steps: 1,
    }),
    [width],
  );
  return (
    <group position={a} quaternion={quaternion}>
      <mesh position={[0, 0, -width * 0.32]} castShadow>
        <extrudeGeometry args={[shape, extrusion]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.33} />
      </mesh>
      <Block
        p={[0, length * 0.45, width * 0.39]}
        s={[width * 0.48, length * 0.55, 0.035]}
        c={dark}
      />
      {[0.2, 0.7].map((v) => (
        <Cylinder
          key={v}
          p={[0, length * v, width * 0.43]}
          r={0.045}
          h={0.035}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}
    </group>
  );
}
function Joint({ p, yaw, r }: { p: Vec; yaw: number; r: number }) {
  return (
    <group position={p} rotation={[0, -yaw, 0]}>
      <Cylinder
        p={[0, 0, 0]}
        r={r}
        h={0.65}
        c={orange}
        rotation={[Math.PI / 2, 0, 0]}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Cylinder
            p={[0, 0, side * 0.36]}
            r={r * 0.82}
            h={0.09}
            c={dark}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Cylinder
            p={[0, 0, side * 0.42]}
            r={r * 0.5}
            h={0.035}
            rotation={[Math.PI / 2, 0, 0]}
          />
          {Array.from({ length: 6 }, (_, i) => (
            <Cylinder
              key={i}
              p={[
                Math.cos((i * Math.PI) / 3) * r * 0.65,
                Math.sin((i * Math.PI) / 3) * r * 0.65,
                side * 0.425,
              ]}
              r={0.025}
              h={0.03}
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
function Robot({ frame: f }: { frame: Frame }) {
  return (
    <group>
      <Block p={[-3.7, 0.12, 0]} s={[1.3, 0.24, 1.3]} c={dark} />
      {[-0.48, 0.48].flatMap((x) =>
        [-0.48, 0.48].map((z) => (
          <Cylinder
            key={`${x}${z}`}
            p={[-3.7 + x, 0.27, z]}
            r={0.07}
            h={0.06}
          />
        )),
      )}
      <Cylinder p={[-3.7, 0.55, 0]} r={0.43} h={0.7} c={orange} />
      <Cylinder p={[-3.7, 0.94, 0]} r={0.47} h={0.12} c={dark} />
      <Block p={[-3.7, 1.17, 0]} s={[0.55, 0.4, 0.55]} c={orange} />
      <Link a={shoulder} b={f.elbow} width={0.55} color={orange} />
      <Link a={f.elbow} b={f.grip} width={0.4} color={orange} />
      <Joint p={shoulder} yaw={f.yaw} r={0.32} />
      <Joint p={f.elbow} yaw={f.yaw} r={0.27} />
      <Line
        points={[
          [shoulder[0], shoulder[1], shoulder[2] - 0.4],
          [f.elbow[0] - 0.18, f.elbow[1] + 0.25, f.elbow[2] - 0.35],
          [f.grip[0], f.grip[1] + 0.2, f.grip[2] - 0.25],
        ]}
        color="#10181c"
        lineWidth={8}
      />
      <group position={f.grip}>
        <Cylinder p={[0, 0, 0]} r={0.19} h={0.32} c={dark} />
        <Cylinder p={[0, -0.14, 0]} r={0.23} h={0.08} />
        <Block p={[0, -0.22, 0]} s={[1.08, 0.13, 0.24]} c={dark} />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Block p={[side * f.opening, -0.29, 0]} s={[0.085, 0.18, 0.2]} />
            <Block
              p={[side * (f.opening - 0.005), -0.36, 0]}
              s={[0.085, 0.05, 0.22]}
              c="#121a20"
            />
          </group>
        ))}
      </group>
    </group>
  );
}
export function Flange({ evidence = false }: { evidence?: boolean }) {
  return (
    <group>
      <Cylinder p={[0, 0.06, 0]} r={0.42} h={0.12} />
      <Cylinder p={[0, 0.14, 0]} r={0.2} h={0.12} />
      <Cylinder p={[0, 0.203, 0]} r={0.105} h={0.008} c="#172127" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Cylinder
          key={i}
          p={[
            Math.cos((i * Math.PI) / 3) * 0.32,
            0.122,
            Math.sin((i * Math.PI) / 3) * 0.32,
          ]}
          r={0.045}
          h={0.006}
          c="#1b252c"
        />
      ))}
      {[0.24, 0.28, 0.39].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.123, 0]}>
          <ringGeometry args={[r, r + 0.0025, 80]} />
          <meshStandardMaterial
            color="#707b80"
            metalness={0.8}
            roughness={0.5}
          />
        </mesh>
      ))}
      <Line
        points={crack.map(([x, z]) => [x, 0.126, z])}
        color="#271b18"
        lineWidth={evidence ? 4 : 2.5}
      />
    </group>
  );
}
const Hall = memo(function Hall() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#3b4449";
    context.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2200; i++) {
      const n = (i * 7919) % 128,
        m = (i * 3571) % 128;
      context.fillStyle = i % 2 ? "#40494d" : "#343e43";
      context.fillRect(n, m, 1, 2);
    }
    context.strokeStyle = "#202d32";
    context.strokeRect(0, 0, 128, 128);
    const t = new CanvasTexture(canvas);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(20, 20);
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          map={texture}
          color="#68777e"
          roughness={0.48}
          metalness={0.3}
        />
      </mesh>
      {[-12, -6, 0, 6, 12].map((x) => (
        <group key={x}>
          <Block p={[x, 4, -6]} s={[0.24, 8, 0.3]} c="#3b474d" />
          <Block p={[x, 7.9, 0]} s={[0.18, 0.2, 14]} c="#49565c" />
          <mesh position={[x, 7.7, -1]}>
            <boxGeometry args={[0.12, 0.06, 7]} />
            <meshBasicMaterial color="#d2dfdc" />
          </mesh>
          <Block p={[x, 2.3, -7]} s={[4.7, 4.5, 0.3]} c="#303b42" />
          {[0, 1, 2].map((i) => (
            <Block
              key={i}
              p={[x, 4.9 + i * 0.7, -7]}
              s={[4.7, 0.57, 0.1]}
              c="#697b83"
            />
          ))}
        </group>
      ))}
      {[-2, 2.7].map((z) => (
        <Block
          key={z}
          p={[-0.3, 0.008, z]}
          s={[10.8, 0.012, 0.06]}
          c="#b49a4d"
          radius={0.004}
        />
      ))}
      {/* Feeder fixture with locator pins */}
      <Block p={[-2.3, 1.17, 1.5]} s={[1.1, 0.15, 1.1]} c={dark} />
      {[-0.4, 0.4].map((x) => (
        <Block key={x} p={[-2.3 + x, 0.6, 1.5]} s={[0.1, 1.1, 0.85]} />
      ))}
      {/* Guarded process enclosure and control cabinet */}
      <Block p={[-1.2, 1.3, -2.5]} s={[2.3, 2.5, 1.4]} c="#727e7d" />
      <Block p={[-1.2, 1.5, -1.78]} s={[1.9, 1.6, 0.04]} c={dark} />
      <Block p={[-1.2, 1.6, -1.75]} s={[1.65, 1.15, 0.025]} c="#13232a" />
      <Block p={[-0.5, 1.4, -1.71]} s={[0.05, 0.35, 0.05]} />
      <Block p={[4.1, 1.15, -2.3]} s={[1.4, 2.3, 0.65]} c="#9ca6a2" />
      <Block p={[4.1, 1.55, -1.95]} s={[0.85, 0.5, 0.04]} c="#162e35" />
      {Array.from({ length: 6 }, (_, i) => (
        <Block
          key={i}
          p={[4.1, 0.4 + i * 0.11, -1.95]}
          s={[0.75, 0.025, 0.025]}
          c={dark}
          radius={0.005}
        />
      ))}
      {/* Finned conveyor drive, wiring and probe */}
      <Cylinder
        p={[0.1, 0.8, 0.95]}
        r={0.28}
        h={0.95}
        c="#607b7d"
        rotation={[0, 0, Math.PI / 2]}
      />
      {Array.from({ length: 9 }, (_, i) => (
        <Cylinder
          key={i}
          p={[-0.29 + i * 0.09, 0.8, 0.95]}
          r={0.3}
          h={0.025}
          c={dark}
          rotation={[0, 0, Math.PI / 2]}
        />
      ))}
      <Block p={[0.1, 1.1, 0.95]} s={[0.27, 0.18, 0.25]} c={dark} />
      <Cylinder p={[0.1, 1.23, 0.95]} r={0.06} h={0.12} c="#65b6af" />
      <Line
        points={[
          [0.1, 1.3, 0.95],
          [0.1, 1.38, 1.1],
          [-0.5, 1.38, 1.1],
          [-0.6, 0.25, 1.1],
          [-1.2, 0.25, -1.8],
        ]}
        color="#151d22"
        lineWidth={3}
      />
      {[-1.25, 0.5, 2.3, 4].map((x) => (
        <group key={x}>
          {[-0.54, 0.54].map((z) => (
            <group key={z}>
              <Block p={[x, 0.6, z]} s={[0.085, 1.15, 0.085]} />
              <Cylinder p={[x, 0.045, z]} r={0.11} h={0.07} c={dark} />
            </group>
          ))}
          <Block p={[x, 0.4, 0]} s={[0.09, 0.1, 1.15]} />
        </group>
      ))}
      {[-0.65, 0.65].map((z) => (
        <group key={z}>
          <Block p={[1.35, 1.15, z]} s={[5.8, 0.22, 0.12]} />
          <Block
            p={[1.35, 1.18, z + Math.sign(z) * 0.065]}
            s={[5.7, 0.025, 0.012]}
            c={dark}
            radius={0.005}
          />
          {Array.from({ length: 10 }, (_, i) => (
            <Cylinder
              key={i}
              p={[-1.1 + i * 0.55, 1.15, z + Math.sign(z) * 0.07]}
              r={0.025}
              h={0.025}
              c={dark}
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
        </group>
      ))}
      <Block p={[1.35, 1.13, 0]} s={[5.8, 0.16, 1.25]} c="#171e23" />
      {/* Inspection gantry with optically aligned lens and ring light */}
      {[-0.85, 0.85].map((z) => (
        <Block key={z} p={[2, 1.7, z]} s={[0.1, 3.4, 0.1]} />
      ))}
      <Block p={[2, 3.36, 0]} s={[0.2, 0.15, 1.8]} />
      <Block p={[2, 3.1, 0]} s={[0.42, 0.4, 0.4]} c="#303e44" />
      <Cylinder p={[2, 2.82, 0]} r={0.16} h={0.25} c="#141d22" />
      <Cylinder p={[2, 2.68, 0]} r={0.12} h={0.025} c="#82a9b5" />
      <mesh position={[2, 2.76, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.25, 0.035, 10, 40]} />
        <meshBasicMaterial color="#d8ede9" />
      </mesh>
    </group>
  );
});
function MovingCell({
  frame: f,
  onInspect,
}: {
  frame: Frame;
  onInspect?: () => void;
}) {
  return (
    <>
      <Robot frame={f} />
      {Array.from({ length: 35 }, (_, i) => (
        <group
          key={i}
          position={[-1.45 + i * 0.165, 1.17, 0]}
          rotation={[Math.PI / 2, 0, f.belt]}
        >
          <Cylinder p={[0, 0, 0]} r={0.08} h={1.15} c="#64737b" />
          <mesh position={[0.075, 0, 0]}>
            <boxGeometry args={[0.01, 1.1, 0.025]} />
            <meshStandardMaterial color="#323e45" />
          </mesh>
        </group>
      ))}
      <group
        position={f.part}
        onClick={(e) => {
          e.stopPropagation();
          if (f.anomaly) onInspect?.();
        }}
      >
        <Flange />
        {f.detection && (
          <>
            <Line
              points={[
                [-0.5, 0.135, -0.5],
                [0.5, 0.135, -0.5],
                [0.5, 0.135, 0.5],
                [-0.5, 0.135, 0.5],
                [-0.5, 0.135, -0.5],
              ]}
              color={f.anomaly ? "#ffb46a" : "#82dfd0"}
              lineWidth={2}
            />
            {!f.anomaly && (
              <Line
                points={[
                  [-0.48 + f.scan * 0.96, 0.14, -0.48],
                  [-0.48 + f.scan * 0.96, 0.14, 0.48],
                ]}
                color="#b9fff0"
                lineWidth={2}
              />
            )}
          </>
        )}
        {f.anomaly && (
          <Line
            points={[
              [0.12, 0.14, -0.25],
              [0.39, 0.14, -0.25],
              [0.39, 0.14, 0.2],
              [0.12, 0.14, 0.2],
              [0.12, 0.14, -0.25],
            ]}
            color="#ffae69"
            lineWidth={2}
          />
        )}
      </group>
      {f.detection &&
        [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
        ].map(([x, z], i) => (
          <Line
            key={i}
            points={[
              [2, 2.65, 0],
              [f.part[0] + x, 1.38, z],
            ]}
            color="#8cddd0"
            transparent
            opacity={0.18}
            lineWidth={1}
          />
        ))}
    </>
  );
}
function Fallback({ frame }: { frame: Frame }) {
  return (
    <div className="cell-fallback">
      <p>SIMPLIFIED PROCESS VIEW · WebGL unavailable</p>
      <svg
        viewBox="0 0 800 340"
        role="img"
        aria-label="Accessible manufacturing sequence"
      >
        <path d="M40 290H760M330 240H730" stroke="#5b737d" strokeWidth="16" />
        <path
          d={`M150 285L150 190L${240 - frame.progress * 70} 90L${320 - frame.progress * 80} 190`}
          stroke="#d99152"
          strokeWidth="28"
          fill="none"
        />
        <circle
          cx={Math.min(670, 260 + frame.progress * 650)}
          cy="218"
          r="24"
          fill="#b5c4ca"
        />
        <path d="M640 50V230M610 50H670" stroke="#84cfc1" strokeWidth="8" />
      </svg>
      <p>
        {
          [
            "Component waiting",
            "Gripping and transferring component",
            "Conveyor transporting component",
            "Inspecting P-004",
            "Surface anomaly captured",
            "Sensor context aligned",
            "Investigation ready",
            "Awaiting operator review",
          ][frame.stage]
        }
      </p>
    </div>
  );
}
class Boundary extends Component<
  { children: ReactNode; frame: Frame },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Fallback frame={this.props.frame} />
    ) : (
      this.props.children
    );
  }
}
function Labels({
  frame,
  refs,
}: {
  frame: Frame;
  refs: RefObject<(HTMLSpanElement | null)[]>;
}) {
  const { camera, size } = useThree();
  useFrame(() => {
    const positions: Vec[] = [
      [frame.part[0], frame.part[1] + 0.23, frame.part[2] - 0.57],
      [0.1, 1.4, 0.95],
    ];
    positions.forEach((v, i) => {
      const el = refs.current[i];
      if (!el) return;
      const p = new Vector3(...v).project(camera);
      const x = ((p.x + 1) / 2) * size.width,
        y =
          ((1 - p.y) / 2) * size.height +
          (i === 1 && size.width < 650 ? 34 : 0);
      el.style.visibility =
        (i === 0 ? frame.detection : frame.time >= 35) &&
        p.z < 1 &&
        x > 40 &&
        x < size.width - 40 &&
        y > 10 &&
        y < size.height - 20
          ? "visible"
          : "hidden";
      el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    });
  });
  return null;
}
export default function FactoryScene({
  progress,
  reduced = false,
  focus,
  onInspect,
}: {
  progress: number;
  reduced?: boolean;
  focus?: string;
  onInspect?: () => void;
}) {
  const frame = useMemo(() => frameAt(progress), [progress]);
  const [supported] = useState(() => {
    try {
      const c = document.createElement("canvas"),
        g = c.getContext("webgl2");
      if (!g) return false;
      g.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  const [lost, setLost] = useState(false);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  if (!supported || lost) return <Fallback frame={frame} />;
  return (
    <Boundary frame={frame}>
      <div className="factory-render">
        <Canvas
          className="factory-canvas"
          role="img"
          aria-label="Articulated robot handling a machined flange on an inspection conveyor"
          frameloop="demand"
          shadows
          dpr={[1, 1.5]}
          camera={{ fov: 42, near: 0.1, far: 100 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener(
              "webglcontextlost",
              () => setLost(true),
              { once: true },
            );
          }}
        >
          <color attach="background" args={["#141e24"]} />
          <fog attach="fog" args={["#141e24", 18, 48]} />
          <Environment />
          <hemisphereLight args={["#c4dce9", "#293335", 0.65]} />
          <directionalLight
            position={[-3, 9, 5]}
            intensity={2.4}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={7}
            shadow-camera-bottom={-6}
            shadow-bias={-0.0004}
          />
          <directionalLight
            position={[4, 6, -5]}
            color="#a7d9ed"
            intensity={2.2}
          />
          <directionalLight
            position={[-6, 4, 0]}
            color="#edbc89"
            intensity={1.6}
          />
          <Hall />
          <MovingCell frame={frame} onInspect={onInspect} />
          <Camera frame={frame} reduced={reduced} focus={focus} />
          <Labels frame={frame} refs={labels} />
        </Canvas>
        <span
          ref={(el) => {
            labels.current[0] = el;
          }}
          className={`cell-tag cell-projected ${frame.anomaly ? "flagged" : ""}`}
        >
          P-004 / {frame.anomaly ? "REVIEW REQUIRED" : "TRACKING"}
        </span>
        <span
          ref={(el) => {
            labels.current[1] = el;
          }}
          className="cell-tag cell-projected"
        >
          DRIVE-01 · {frame.sensors.temperature.toFixed(1)} °C · SIM
        </span>
      </div>
    </Boundary>
  );
}
