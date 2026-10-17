import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Line, Instances, Instance } from "@react-three/drei";
import {
  CanvasTexture,
  RepeatWrapping,
  Group,
  MeshStandardMaterial,
  type Mesh,
} from "three";
import {
  IndustrialFinish,
  Metal,
  Cable,
  Bolt,
  Nameplate,
  MachinedFlange,
  VentedCover,
} from "./Hardware";
import type { Equipment } from "../simulation/engine";
import { storyState, type StoryClock, type V3 } from "./director";

const steel = "#a6adb0",
  graphite = "#282d32",
  orange = "#ff7a32";
function Block({
  at,
  size,
  color = graphite,
  round = true,
  rotation = [0, 0, 0],
}: {
  at: V3;
  size: V3;
  color?: string;
  round?: boolean;
  rotation?: V3;
}) {
  return round ? (
    <RoundedBox
      args={size}
      radius={Math.min(...size) * 0.16}
      smoothness={2}
      position={at}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <Metal color={color} painted={color !== steel} />
    </RoundedBox>
  ) : (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <Metal color={color} painted={color !== steel} />
    </mesh>
  );
}
function Shaft({
  at,
  r = 0.1,
  length = 0.3,
  color = steel,
  rotation = [Math.PI / 2, 0, 0],
}: {
  at: V3;
  r?: number;
  length?: number;
  color?: string;
  rotation?: V3;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow>
      <cylinderGeometry args={[r, r, length, 48]} />
      <Metal color={color} />
    </mesh>
  );
}
function Ring({
  at,
  r,
  tube = 0.025,
  color = steel,
  rotation = [Math.PI / 2, 0, 0],
}: {
  at: V3;
  r: number;
  tube?: number;
  color?: string;
  rotation?: V3;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow>
      <torusGeometry args={[r, tube, 8, 48]} />
      <Metal color={color} />
    </mesh>
  );
}
export default function Machinery({
  clock,
  consoleTime,
  onFocus,
}: {
  clock: React.RefObject<StoryClock>;
  consoleTime?: number;
  onFocus?: (equipment: Equipment) => void;
}) {
  const marker = useRef<Mesh>(null),
    side = useRef<Group>(null),
    cover = useRef<Group>(null),
    door = useRef<Group>(null),
    motor = useRef<Group>(null),
    hero = useRef<Group>(null),
    scan = useRef<Mesh>(null),
    flow = useRef<Group>(null),
    trace = useRef<Group>(null);
  const phase = useRef(0);
  const signalMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#67c8d8",
        emissive: "#67c8d8",
        emissiveIntensity: 1,
      }),
    [],
  );
  const rollerTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 8;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#b9bfbd";
    ctx.fillRect(0, 0, 32, 8);
    ctx.fillStyle = "#7e878a";
    ctx.fillRect(0, 0, 3, 8);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    return texture;
  }, []);
  useEffect(
    () => () => {
      signalMaterial.dispose();
      rollerTexture.dispose();
    },
    [signalMaterial, rollerTexture],
  );
  useFrame((_, dt) => {
    const s = storyState(
      clock.current.reduced
        ? Math.round(clock.current.progress * 6) / 6
        : clock.current.progress,
    );
    if (consoleTime !== undefined) {
      s.explode = 0;
      s.inspection = consoleTime >= 32 ? 0.7 : 0;
      s.evidence = 0;
      phase.current = consoleTime * 0.35;
    }
    if (
      consoleTime === undefined &&
      !clock.current.paused &&
      !clock.current.reduced
    )
      phase.current += Math.min(dt, 0.05) * 0.35;
    if (marker.current) {
      marker.current.visible = s.inspection > 0.01;
      (marker.current.material as MeshStandardMaterial).opacity = s.inspection;
    }
    rollerTexture.offset.x = phase.current;
    if (side.current) side.current.position.x = s.explode * 0.85;
    if (cover.current) cover.current.position.y = s.explode * 1.55;
    if (door.current) {
      door.current.position.z = s.explode * 1.2;
      door.current.position.x = -s.explode * 1.1;
    }
    if (motor.current) motor.current.position.x = -s.explode * 0.9;
    if (hero.current) {
      hero.current.position.x = s.productX;
      hero.current.rotation.y = s.productTurn;
    }
    if (scan.current) {
      scan.current.visible = s.inspection > 0.01;
      scan.current.scale.x = 0.5 + s.inspection * 0.5;
      (scan.current.material as MeshStandardMaterial).opacity =
        s.inspection * 0.18;
    }
    if (flow.current)
      flow.current.children.forEach((child, i) => {
        child.position.x = ((phase.current + i * 2.9) % 11) - 5.5;
        child.visible = Math.abs(child.position.x - s.productX) > 1.2;
      });
    if (trace.current) trace.current.visible = s.evidence > 0.08;
    signalMaterial.emissiveIntensity = 0.4 + s.inspection * 2;
  });
  return (
    <IndustrialFinish>
      <group>
        {/* Floating foundation is a continuous, physically coherent production cell. */}
        <Block
          at={[0, -0.06, -0.3]}
          size={[12.6, 0.12, 5.7]}
          color="#c0c1b9"
          round
        />
        {[-2.95, 2.45].map((z) => (
          <Block
            key={z}
            at={[0, 0.008, z]}
            size={[11.8, 0.012, 0.025]}
            color="#626962"
          />
        ))}
        {[-5.9, 5.9].map((x) => (
          <Block
            key={x}
            at={[x, 0.008, -0.25]}
            size={[0.025, 0.012, 5.4]}
            color="#626962"
          />
        ))}
        <group
          onClick={
            onFocus
              ? (e) => {
                  e.stopPropagation();
                  onFocus("conveyor");
                }
              : undefined
          }
        >
          {/* Conveyor with instanced rollers and bolted rails */}
          <Block
            at={[0, 1.05, 0.35]}
            size={[11.4, 0.26, 1.6]}
            color={graphite}
            round
          />
          <Instances limit={44} castShadow receiveShadow>
            <cylinderGeometry args={[0.085, 0.085, 1.3, 12]} />
            <meshStandardMaterial
              color="#9da5a8"
              map={rollerTexture}
              metalness={0.85}
              roughness={0.3}
            />
            {Array.from({ length: 44 }, (_, i) => (
              <Instance
                key={i}
                position={[-5.4 + i * 0.25, 1.23, 0.35]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            ))}
          </Instances>
          {[-0.44, 1.14].map((z) => (
            <group key={z}>
              <Block
                at={[0, 1.25, z]}
                size={[11.5, 0.21, 0.11]}
                color={steel}
              />
              <Block
                at={[0, 1.32, z + 0.06]}
                size={[11.5, 0.028, 0.02]}
                color="#e0e0d5"
              />
            </group>
          ))}
          <Instances limit={48}>
            <cylinderGeometry args={[0.032, 0.032, 0.02, 6]} />
            <meshStandardMaterial
              color="#363c42"
              metalness={0.8}
              roughness={0.3}
            />
            {Array.from({ length: 24 }, (_, i) =>
              [-0.505, 1.205].map((z) => (
                <Instance
                  key={`${i}-${z}`}
                  position={[-5.4 + i * 0.47, 1.25, z]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              )),
            )}
          </Instances>
          {[-4.7, -1.6, 1.6, 4.7].map((x) => (
            <group key={x}>
              {[-0.28, 0.98].map((z) => (
                <group key={z}>
                  <Block
                    at={[x, 0.58, z]}
                    size={[0.12, 1.1, 0.12]}
                    color={steel}
                  />
                  <Shaft
                    at={[x, 0.09, z]}
                    r={0.13}
                    length={0.15}
                    color={graphite}
                    rotation={[0, 0, 0]}
                  />
                </group>
              ))}
              <Block
                at={[x, 0.35, 0.35]}
                size={[0.1, 0.1, 1.4]}
                color={steel}
              />
            </group>
          ))}
        </group>
        {consoleTime === undefined && (
          <>
            {/* Secondary products move independently; the story product is scroll controlled. */}
            <group ref={flow}>
              {[0, 1, 2].map((i) => (
                <group key={i} position={[i * 3, 1.34, 0.35]} scale={0.75}>
                  <MachinedFlange />
                </group>
              ))}
            </group>
            <group ref={hero} position={[-4.5, 1.34, 0.35]}>
              <MachinedFlange defect />
              <mesh
                ref={marker}
                position={[0.29, 0.181, 0.17]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <ringGeometry args={[0.17, 0.184, 48]} />
                <meshBasicMaterial
                  color="#ff7a32"
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
              </mesh>
            </group>
          </>
        )}
        {/* Thermal housing: removable roof and service door reveal heater, motor and sensors. */}
        <group
          position={[-2.7, 0, -1.25]}
          onClick={
            onFocus
              ? (e) => {
                  e.stopPropagation();
                  onFocus("temperature");
                }
              : undefined
          }
        >
          <Block at={[0, 0.21, 0]} size={[2.9, 0.42, 1.7]} round />
          <Block
            at={[0, 1.55, -0.78]}
            size={[2.8, 2.4, 0.13]}
            color="#b6bab4"
            round
          />
          {[-1.34, 1.34].map((x) => (
            <group key={x} ref={x > 0 ? side : undefined}>
              <Block
                at={[x, 1.55, 0]}
                size={[0.13, 2.4, 1.7]}
                color="#bdc0b8"
              />
              <Block
                at={[x, 0.65, 0.87]}
                size={[0.08, 0.4, 0.04]}
                color={orange}
              />
            </group>
          ))}
          <group ref={cover}>
            <VentedCover />
            <Block
              at={[0.98, 2.95, 0]}
              size={[0.06, 0.1, 0.65]}
              color={graphite}
            />
          </group>
          <group ref={door}>
            {[-1.17, 1.17].map((x) => (
              <Block
                key={x}
                at={[x, 1.75, 0.89]}
                size={[0.24, 1.85, 0.11]}
                color="#626c70"
              />
            ))}
            {[0.925, 2.575].map((y) => (
              <Block
                key={y}
                at={[0, y, 0.89]}
                size={[2.1, 0.2, 0.11]}
                color="#626c70"
              />
            ))}
            <mesh position={[0, 1.75, 0.89]}>
              <boxGeometry args={[2.1, 1.45, 0.022]} />
              <meshPhysicalMaterial
                color="#839a9d"
                metalness={0.05}
                roughness={0.12}
                transparent
                opacity={0.3}
                depthWrite={false}
              />
            </mesh>
            <Nameplate
              at={[-0.66, 2.58, 0.956]}
              title="THERMAL CELL"
              subtitle="TC–01 / PROCESS MODULE"
              width={0.78}
            />
            {[-1.17, 1.17].map((x) =>
              [0.94, 2.56].map((y) => (
                <Bolt key={`${x}-${y}`} at={[x, y, 0.958]} />
              )),
            )}
            <Block
              at={[1.03, 1.68, 1]}
              size={[0.045, 0.4, 0.09]}
              color={steel}
            />
            <Block
              at={[-0.94, 2.4, 0.96]}
              size={[0.34, 0.055, 0.01]}
              color={orange}
            />
            {[-1.18, 1.18].map((x) =>
              [0.93, 2.57].map((y) => (
                <Shaft
                  key={`${x}-${y}`}
                  at={[x, y, 0.956]}
                  r={0.025}
                  length={0.025}
                />
              )),
            )}
          </group>
          {/* Heater bank and heat-exchanger fins */}
          {Array.from({ length: 7 }, (_, i) => (
            <group key={i}>
              <Ring
                at={[-0.85 + i * 0.28, 1.65, 0]}
                r={0.45}
                tube={0.045}
                color="#b78a60"
                rotation={[0, Math.PI / 2, 0]}
              />
              <Block
                at={[-0.85 + i * 0.28, 1.1, 0]}
                size={[0.05, 0.13, 0.9]}
                color={steel}
              />
            </group>
          ))}
          <Shaft
            at={[0, 1.65, 0]}
            r={0.1}
            length={2.4}
            rotation={[0, 0, Math.PI / 2]}
          />
          <Block
            at={[1, 2.18, 0.1]}
            size={[0.22, 0.2, 0.28]}
            color={orange}
            round
          />
          <Shaft
            at={[1, 2.02, 0.1]}
            r={0.035}
            length={0.3}
            rotation={[0, 0, 0]}
          />
          <Line
            points={[
              [1, 2.27, 0.1],
              [1, 2.5, 0.1],
              [1.18, 2.5, -0.5],
              [1.18, 0.5, -0.5],
            ]}
            color="#474e54"
            lineWidth={2}
          />
          <group
            ref={motor}
            position={[0, 0, 0]}
            onClick={
              onFocus
                ? (e) => {
                    e.stopPropagation();
                    onFocus("motor");
                  }
                : undefined
            }
          >
            <Block
              at={[-1.9, 0.44, 0.2]}
              size={[1.25, 0.17, 0.7]}
              color={graphite}
            />
            <Shaft
              at={[-1.9, 0.78, 0.2]}
              r={0.3}
              length={1.1}
              color="#535f64"
              rotation={[0, 0, Math.PI / 2]}
            />
            {Array.from({ length: 10 }, (_, i) => (
              <Shaft
                key={i}
                at={[-2.35 + i * 0.095, 0.78, 0.2]}
                r={0.33}
                length={0.025}
                color="#929e9d"
                rotation={[0, 0, Math.PI / 2]}
              />
            ))}
            <Shaft
              at={[-1.22, 0.78, 0.2]}
              r={0.11}
              length={0.3}
              rotation={[0, 0, Math.PI / 2]}
            />
            <Block
              at={[-1.85, 1.12, 0.2]}
              size={[0.35, 0.2, 0.27]}
              color={graphite}
              round
            />
            <Block
              at={[-2.22, 1.14, 0.2]}
              size={[0.12, 0.16, 0.14]}
              color="#67c8d8"
            />
          </group>
        </group>
        <Cable
          points={[
            [-4.5, 1.15, -1.04],
            [-4.6, 1.3, -1.5],
            [-4.6, 0.35, -1.9],
            [-3.8, 0.16, -2.25],
            [3.8, 0.16, -2.25],
            [4.7, 0.32, -1.9],
          ]}
          radius={0.034}
        />
        {[-4.7, -1.6, 1.6, 4.7].map((x) =>
          [-0.28, 0.98].map((z) => (
            <group key={`${x}-${z}`}>
              <Block
                at={[x, 0.92, z]}
                size={[0.34, 0.11, 0.18]}
                color={steel}
              />
              <Bolt at={[x, 0.92, z + 0.1]} />
              <Shaft
                at={[x, 0.15, z]}
                r={0.04}
                length={0.18}
                rotation={[0, 0, 0]}
              />
              <Shaft
                at={[x, 0.045, z]}
                r={0.15}
                length={0.045}
                color="#343a3b"
                rotation={[0, 0, 0]}
              />
            </group>
          )),
        )}
        {[-0.505, 1.205].map((z) => (
          <Block
            key={z}
            at={[0, 1.2, z]}
            size={[11.2, 0.028, 0.018]}
            color="#4b5458"
          />
        ))}
        <Nameplate
          at={[-3.6, 1.04, 1.16]}
          title="VFG / LINE 01"
          subtitle="PRECISION INSPECTION"
          width={0.85}
        />
        {/* Inspection bridge, camera lens, ring light and cables */}
        <group
          position={[1.65, 0, 0.35]}
          onClick={
            onFocus
              ? (e) => {
                  e.stopPropagation();
                  onFocus("camera");
                }
              : undefined
          }
        >
          {[-1.06, 1.06].map((z) => (
            <group key={z}>
              <Block at={[0, 1.75, z]} size={[0.17, 3.5, 0.17]} color={steel} />
              <Block
                at={[0, 0.08, z]}
                size={[0.48, 0.16, 0.48]}
                color={graphite}
                round
              />
              <Block
                at={[0.095, 1.9, z]}
                size={[0.022, 2.9, 0.05]}
                color="#353c40"
              />
            </group>
          ))}
          <Block at={[0, 3.5, 0]} size={[0.3, 0.22, 2.35]} color={steel} />
          <Block
            at={[0, 3.18, 0]}
            size={[0.65, 0.46, 0.6]}
            color="#303a40"
            round
          />
          {Array.from({ length: 5 }, (_, i) => (
            <Block
              key={i}
              at={[0.332, 3.02 + i * 0.065, 0]}
              size={[0.012, 0.026, 0.45]}
              color="#151b20"
            />
          ))}
          <Nameplate
            at={[0, 3.2, 0.307]}
            title="VISION"
            subtitle="CV–01"
            width={0.45}
          />
          <Cable
            points={[
              [0.2, 3.36, -0.25],
              [0.27, 3.65, -0.25],
              [0.1, 3.75, -1.05],
              [0, 2.8, -1.17],
              [0, 0.3, -1.17],
            ]}
            radius={0.025}
          />
          {[0, 1, 2, 3].map((i) => (
            <Ring
              key={i}
              at={[0, 2.73 + i * 0.035, 0]}
              r={0.193}
              tube={0.008}
              color="#697276"
            />
          ))}
          <Shaft
            at={[0, 2.83, 0]}
            r={0.19}
            length={0.26}
            color={graphite}
            rotation={[0, 0, 0]}
          />
          <Ring at={[0, 2.68, 0]} r={0.19} tube={0.025} />
          <Shaft
            at={[0, 2.68, 0]}
            r={0.125}
            length={0.01}
            color="#26424c"
            rotation={[0, 0, 0]}
          />
          <mesh
            position={[0, 2.56, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={signalMaterial}
          >
            <torusGeometry args={[0.42, 0.035, 8, 48]} />
          </mesh>
          <Line
            points={[
              [0.2, 3.35, -0.25],
              [0.2, 3.75, -0.25],
              [0, 3.75, -1.15],
              [0, 0.3, -1.15],
            ]}
            color="#41494d"
            lineWidth={2}
          />
          <mesh ref={scan} position={[0, 1.96, 0]}>
            <coneGeometry args={[0.57, 1.18, 32, 1, true]} />
            <meshStandardMaterial
              color="#67c8d8"
              transparent
              opacity={0.12}
              depthWrite={false}
              side={2}
            />
          </mesh>
        </group>
        {/* Evidence connections join physical sources, not decorative particles. */}
        <group ref={trace}>
          <Line
            points={[
              [1.65, 1.85, 0.35],
              [1.65, 3.9, 0.35],
              [-1.7, 3.9, -1.15],
              [-1.7, 2.3, -1.15],
            ]}
            color="#ff7a32"
            lineWidth={1.4}
            dashed
            dashSize={0.12}
            gapSize={0.09}
          />
          <Line
            points={[
              [-5.8, 1.2, -1.05],
              [-5.8, 3.9, -1.05],
              [-1.7, 3.9, -1.15],
            ]}
            color="#67c8d8"
            lineWidth={1.2}
            dashed
            dashSize={0.1}
            gapSize={0.1}
          />
        </group>
        {/* Operator cabinet */}
        <group
          position={[4.6, 0, -1.6]}
          onClick={
            onFocus
              ? (e) => {
                  e.stopPropagation();
                  onFocus("control");
                }
              : undefined
          }
        >
          <Block
            at={[0, 0.95, 0]}
            size={[1.15, 1.9, 0.6]}
            color="#b6bab4"
            round
          />
          <Block
            at={[0, 1.05, 0.315]}
            size={[0.97, 1.55, 0.025]}
            color="#9ea69f"
          />
          <Block
            at={[0, 1.43, 0.34]}
            size={[0.7, 0.45, 0.035]}
            color="#1d2c31"
            round
          />
          <Block
            at={[-0.13, 1.43, 0.365]}
            size={[0.35, 0.012, 0.005]}
            color="#67c8d8"
          />
          <Shaft
            at={[0.29, 1.04, 0.36]}
            r={0.055}
            length={0.04}
            color={orange}
          />
          <Block
            at={[0.4, 0.7, 0.36]}
            size={[0.025, 0.22, 0.04]}
            color={graphite}
          />
          {[0, 1, 2, 3].map((i) => (
            <Block
              key={i}
              at={[0, 0.35 + i * 0.07, 0.34]}
              size={[0.65, 0.02, 0.02]}
              color={graphite}
            />
          ))}
        </group>
        <Line
          points={[
            [-4.5, 0.12, -2.25],
            [4.6, 0.12, -2.25],
            [4.6, 0.3, -1.6],
          ]}
          color="#3b4347"
          lineWidth={3}
        />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.125, 0]}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <shadowMaterial transparent opacity={0.23} />
        </mesh>
      </group>
    </IndustrialFinish>
  );
}
