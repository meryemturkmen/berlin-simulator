"use client";

import { Sky } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { Joystick } from "@/components/hud/Joystick";
import { useIsTouch } from "@/lib/useIsTouch";
import { useT } from "@/lib/i18n/useT";
import { useKeyboardInput } from "./input";
import { Player } from "./player/Player";
import { installDebugProbe } from "./runtime";
import { useProfile } from "./store/profile";
import { useLookControls } from "./useLookControls";

const SPAWN = { position: [0, 0.1, 0] as [number, number, number], heading: 0 };

function TestGround() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[100, 0.5, 100]} position={[0, -0.5, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#8fb873" />
        </mesh>
      </RigidBody>
      {[
        [4, 0.75, -6, "#e4604a"],
        [-5, 0.75, -3, "#f3b95f"],
        [2, 0.75, 7, "#3f6fb0"],
      ].map(([x, y, z, color]) => (
        <RigidBody
          key={`${x}-${z}`}
          type="fixed"
          position={[x as number, y as number, z as number]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial color={color as string} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

export default function Game() {
  const t = useT();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const isTouch = useIsTouch();
  const status = useProfile((state) => state.status);
  const avatar = useProfile((state) => state.avatar);
  const hydrate = useProfile((state) => state.hydrate);

  useKeyboardInput();
  useLookControls(root);

  useEffect(() => {
    installDebugProbe();
    void hydrate();
  }, [hydrate]);

  // No avatar yet: send the player to the editor first.
  useEffect(() => {
    if (status === "ready" && !avatar) router.replace("/avatar");
  }, [status, avatar, router]);

  return (
    <div ref={root} className="game-root bg-sky" data-testid="game-root">
      {avatar && (
        <Canvas shadows camera={{ position: [0, 3, 8], fov: 55, near: 0.1, far: 600 }} dpr={[1, 2]}>
          <Sky sunPosition={[40, 30, 20]} turbidity={6} rayleigh={1.2} />
          <hemisphereLight args={["#dfeeff", "#6f8a5a", 0.9]} />
          <directionalLight
            position={[40, 30, 20]}
            intensity={2.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
          />
          <Suspense fallback={null}>
            <Physics timeStep="vary">
              <TestGround />
              <Player look={avatar} spawn={SPAWN} />
            </Physics>
          </Suspense>
        </Canvas>
      )}

      <p className="bg-ink/55 pointer-events-none absolute top-3 left-1/2 w-max max-w-[92vw] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm text-white backdrop-blur">
        {t(isTouch ? "hud.controlsMobile" : "hud.controlsDesktop")}
      </p>
      {isTouch && <Joystick />}
    </div>
  );
}
