import { Environment, Lightformer, SoftShadows } from "@react-three/drei";
/** Shared studio rig: broad reflections describe metal, soft contact shadows anchor it. */
export default function Lighting() {
  return (
    <>
      <SoftShadows size={12} samples={8} focus={0.4} />
      <ambientLight intensity={0.4} />
      <hemisphereLight args={["#eff6ff", "#716c5f", 0.75]} />
      <directionalLight
        position={[-3, 10, 7]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-normalBias={0.025}
        shadow-bias={-0.0001}
      />
      <directionalLight
        position={[-7, 6, -3]}
        intensity={1.3}
        color="#bbd2e0"
      />
      <Environment resolution={256} frames={1}>
        <Lightformer
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 6, 1]}
          intensity={3}
        />
        <Lightformer
          position={[5, 4, 3]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 7, 1]}
          intensity={3}
        />
        <Lightformer
          position={[-5, 3, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[8, 4, 1]}
          intensity={2}
        />
        <Lightformer position={[0, 4, -6]} scale={[10, 3, 1]} intensity={2} />
      </Environment>
    </>
  );
}
