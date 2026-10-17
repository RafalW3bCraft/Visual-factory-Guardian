import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  Path,
  Vector2,
  Vector3,
  CatmullRomCurve3,
} from "three";
import type { V3 } from "./director";

const Finish = createContext<CanvasTexture | null>(null);
/** A local, deterministic microfinish. No remote textures or runtime asset requests. */
export function IndustrialFinish({ children }: { children: ReactNode }) {
  const grain = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 1249;
    for (let y = 0; y < 256; y++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const value = 95 + (seed % 65);
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(0, y, 256, 1);
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(2, 3);
    return texture;
  }, []);
  useEffect(() => () => grain.dispose(), [grain]);
  return <Finish.Provider value={grain}>{children}</Finish.Provider>;
}
export function Metal({
  color = "#bbc2c3",
  painted = false,
}: {
  color?: string;
  painted?: boolean;
}) {
  const grain = useContext(Finish);
  return (
    <meshStandardMaterial
      color={color}
      metalness={painted ? 0.35 : 0.92}
      roughness={painted ? 0.38 : 0.28}
      bumpMap={grain}
      bumpScale={painted ? 0.001 : 0.0003}
    />
  );
}
export function Cable({
  points,
  radius = 0.026,
  color = "#272c2e",
}: {
  points: V3[];
  radius?: number;
  color?: string;
}) {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        points.map((p) => new Vector3(...p)),
        false,
        "centripetal",
      ),
    [points],
  );
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 32, radius, 8, false]} />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
    </mesh>
  );
}
export function Bolt({
  at,
  rotation = [Math.PI / 2, 0, 0],
}: {
  at: V3;
  rotation?: V3;
}) {
  return (
    <group position={at} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[0.044, 0.044, 0.027, 6]} />
        <Metal color="#81898b" />
      </mesh>
      <mesh position={[0, 0.014, 0]}>
        <cylinderGeometry args={[0.019, 0.019, 0.002, 6]} />
        <meshStandardMaterial color="#22292c" />
      </mesh>
    </group>
  );
}
export function Nameplate({
  at,
  title,
  subtitle,
  width = 0.6,
}: {
  at: V3;
  title: string;
  subtitle: string;
  width?: number;
}) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#222b2f";
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = "#e8ebe5";
    ctx.font = "500 40px sans-serif";
    ctx.fillText(title, 24, 62);
    ctx.fillStyle = "#aab6b8";
    ctx.font = "22px monospace";
    ctx.fillText(subtitle, 24, 108);
    ctx.fillStyle = "#c8824e";
    ctx.fillRect(24, 132, 92, 4);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [title, subtitle]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={at}>
      <planeGeometry args={[width, width * 0.3125]} />
      <meshStandardMaterial map={map} roughness={0.55} metalness={0.2} />
    </mesh>
  );
}
/** Extruded through-holes and turned bore remain open from every camera angle. */
export function MachinedFlange({ defect = false }: { defect?: boolean }) {
  const shape = useMemo(() => {
    const outline = new Shape();
    outline.absarc(0, 0, 0.49, 0, Math.PI * 2, false);
    const bore = new Path();
    bore.absarc(0, 0, 0.145, 0, Math.PI * 2, true);
    outline.holes.push(bore);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        hole = new Path();
      hole.absarc(
        Math.cos(a) * 0.37,
        Math.sin(a) * 0.37,
        0.046,
        0,
        Math.PI * 2,
        true,
      );
      outline.holes.push(hole);
    }
    return outline;
  }, []);
  const profile = useMemo(
    () =>
      [
        [0.145, 0.12],
        [0.145, 0.32],
        [0.153, 0.33],
        [0.232, 0.33],
        [0.245, 0.315],
        [0.245, 0.235],
        [0.273, 0.19],
        [0.29, 0.165],
        [0.29, 0.12],
        [0.145, 0.12],
      ].map((p) => new Vector2(...(p as [number, number]))),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} castShadow>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 0.125,
              bevelEnabled: true,
              bevelSegments: 2,
              steps: 1,
              bevelSize: 0.008,
              bevelThickness: 0.008,
              curveSegments: 64,
            },
          ]}
        />
        <Metal />
      </mesh>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[profile, 80]} />
        <Metal />
      </mesh>
      {defect && (
        <Cable
          points={[
            [0.245, 0.155, 0.16],
            [0.29, 0.155, 0.185],
            [0.32, 0.155, 0.17],
            [0.36, 0.155, 0.22],
            [0.398, 0.155, 0.255],
          ]}
          radius={0.0038}
          color="#40372c"
        />
      )}
    </group>
  );
}

export function VentedCover() {
  const panel = useMemo(() => {
    const s = new Shape();
    s.moveTo(-1.45, -0.9);
    s.lineTo(1.45, -0.9);
    s.quadraticCurveTo(1.48, -0.9, 1.48, -0.87);
    s.lineTo(1.48, 0.87);
    s.quadraticCurveTo(1.48, 0.9, 1.45, 0.9);
    s.lineTo(-1.45, 0.9);
    s.quadraticCurveTo(-1.48, 0.9, -1.48, 0.87);
    s.lineTo(-1.48, -0.87);
    s.quadraticCurveTo(-1.48, -0.9, -1.45, -0.9);
    for (let i = 0; i < 8; i++) {
      const x = -0.7 + i * 0.2,
        h = new Path();
      h.moveTo(x - 0.038, -0.5);
      h.lineTo(x - 0.038, 0.5);
      h.absarc(x, 0.5, 0.038, Math.PI, 0, true);
      h.lineTo(x + 0.038, -0.5);
      h.absarc(x, -0.5, 0.038, 0, -Math.PI, true);
      s.holes.push(h);
    }
    return s;
  }, []);
  return (
    <mesh
      position={[0, 2.78, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <extrudeGeometry
        args={[
          panel,
          {
            depth: 0.13,
            bevelEnabled: true,
            bevelSegments: 2,
            bevelSize: 0.014,
            bevelThickness: 0.014,
            curveSegments: 8,
          },
        ]}
      />
      <Metal color="#b7bdbb" />
    </mesh>
  );
}
