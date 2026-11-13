"use client";

import { Sky } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

export default function Game() {
  return (
    <div className="game-root" data-testid="game-root">
      <Canvas shadows camera={{ position: [0, 3, 8], fov: 55 }} dpr={[1, 2]}>
        <Sky sunPosition={[40, 30, 20]} turbidity={6} rayleigh={1.2} />
        <hemisphereLight args={["#dfeeff", "#6f8a5a", 0.9]} />
        <directionalLight position={[40, 30, 20]} intensity={2.2} castShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#8fb873" />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color="#e4604a" flatShading />
        </mesh>
      </Canvas>
    </div>
  );
}
