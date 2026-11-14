"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type * as THREE from "three";
import { AvatarModel } from "@/game/avatar/AvatarModel";
import type { AvatarLook } from "@/game/avatar/schema";

function Turntable({ look, angleRef }: { look: AvatarLook; angleRef: RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    // Ease toward the requested angle so button presses and drags both feel smooth.
    const current = group.current.rotation.y;
    group.current.rotation.y = current + (angleRef.current - current) * Math.min(1, delta * 10);
  });
  return (
    <group ref={group}>
      <AvatarModel look={look} />
    </group>
  );
}

export default function AvatarPreview({
  look,
  angleRef,
}: {
  look: AvatarLook;
  angleRef: RefObject<number>;
}) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.15, 4.6], fov: 30 }}>
      <hemisphereLight args={["#fff6e8", "#c9b79c", 1.3]} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={0.7} color="#ffd7b0" />
      <group position={[0, -0.85, 0]}>
        <Turntable look={look} angleRef={angleRef} />
        <mesh position={[0, -0.06, 0]} receiveShadow>
          <cylinderGeometry args={[0.95, 1.05, 0.12, 40]} />
          <meshStandardMaterial color="#efe3cd" roughness={1} />
        </mesh>
        <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={3} blur={2.2} far={2} />
      </group>
    </Canvas>
  );
}
