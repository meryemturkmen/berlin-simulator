"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { AvatarLook } from "./schema";

export type SitMode = "none" | "bench" | "ground";

/** Mutable animation input. Owners write to it every frame; the model reads it. */
export interface AvatarPose {
  /** Horizontal speed in m/s. Drives the walk and run cycle. */
  speed: number;
  sit: SitMode;
  waving: boolean;
  talking: boolean;
  /** Both hands in front of the body, e.g. for a guitar. */
  playing: boolean;
  /** Right arm stretched out, pointing. */
  pointing: boolean;
}

export function createPose(overrides: Partial<AvatarPose> = {}): AvatarPose {
  return {
    speed: 0,
    sit: "none",
    waving: false,
    talking: false,
    playing: false,
    pointing: false,
    ...overrides,
  };
}

const BUILD = {
  slim: { width: 0.88, limb: 0.9 },
  medium: { width: 1, limb: 1 },
  strong: { width: 1.18, limb: 1.16 },
} as const;

// Body proportions in meters for the medium build. The figure faces +Z.
const HIP_Y = 0.9;
const THIGH = 0.43;
const SHIN = 0.41;
const SHOULDER_Y = 1.44;
const UPPER_ARM = 0.29;
const FOREARM = 0.26;
const HEAD_Y = 1.66;
const HEAD_R = 0.135;
export const AVATAR_HEIGHT = 1.82;

const WALK_SPEED_REF = 3.4;
const SOLE_COLOR = "#f4efe6";
const EYE_COLOR = "#221c1c";

interface LimbProps {
  length: number;
  radius: number;
  material: THREE.Material;
  children?: ReactNode;
}

/** A capsule hanging down from its pivot at the group origin. */
function Segment({ length, radius, material }: LimbProps) {
  return (
    <mesh position={[0, -length / 2, 0]} material={material} castShadow>
      <capsuleGeometry args={[radius, Math.max(0.01, length - radius), 4, 12]} />
    </mesh>
  );
}

function Hair({ style, material }: { style: AvatarLook["hairStyle"]; material: THREE.Material }) {
  const r = HEAD_R;
  if (style === "bald") return null;

  // Sphere sections: phi = PI/2 points to the face (+Z), so shells open there.
  const cap = (scale: number, theta: number, tilt = -0.28) => (
    <mesh material={material} rotation={[tilt, 0, 0]} castShadow>
      <sphereGeometry args={[r * scale, 18, 10, 0, Math.PI * 2, 0, Math.PI * theta]} />
    </mesh>
  );
  const shell = (scale: number, theta: number) => (
    <mesh material={material} castShadow>
      <sphereGeometry
        args={[r * scale, 18, 12, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * theta]}
      />
    </mesh>
  );

  switch (style) {
    case "buzz":
      return cap(1.025, 0.46, -0.32);
    case "short":
      return (
        <>
          {cap(1.08, 0.5)}
          <mesh material={material} position={[0, r * 0.62, r * 0.66]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[r * 1.3, r * 0.3, r * 0.5]} />
          </mesh>
        </>
      );
    case "bob":
      return (
        <>
          {cap(1.1, 0.42, -0.2)}
          {shell(1.12, 0.78)}
        </>
      );
    case "long":
      return (
        <>
          {cap(1.1, 0.42, -0.2)}
          {shell(1.12, 0.74)}
          <mesh material={material} position={[0, -r * 1.05, -r * 0.62]} castShadow>
            <boxGeometry args={[r * 1.9, r * 1.9, r * 0.7]} />
          </mesh>
        </>
      );
    case "bun":
      return (
        <>
          {cap(1.07, 0.52)}
          <mesh material={material} position={[0, r * 1.02, -r * 0.42]} castShadow>
            <sphereGeometry args={[r * 0.46, 12, 10]} />
          </mesh>
        </>
      );
    case "ponytail":
      return (
        <>
          {cap(1.07, 0.52)}
          <mesh
            material={material}
            position={[0, r * 0.05, -r * 1.2]}
            rotation={[0.5, 0, 0]}
            castShadow
          >
            <capsuleGeometry args={[r * 0.24, r * 1.1, 3, 8]} />
          </mesh>
        </>
      );
    case "curly": {
      const curls: [number, number, number][] = [
        [0, 0.95, 0],
        [0.6, 0.72, 0.1],
        [-0.6, 0.72, 0.1],
        [0.32, 0.86, 0.5],
        [-0.32, 0.86, 0.5],
        [0.45, 0.72, -0.55],
        [-0.45, 0.72, -0.55],
        [0, 0.62, -0.85],
        [0.82, 0.25, -0.3],
        [-0.82, 0.25, -0.3],
        [0.5, 0.15, -0.8],
        [-0.5, 0.15, -0.8],
      ];
      return (
        <>
          {curls.map(([x, y, z], index) => (
            <mesh key={index} material={material} position={[x * r, y * r, z * r]} castShadow>
              <sphereGeometry args={[r * 0.48, 8, 6]} />
            </mesh>
          ))}
        </>
      );
    }
  }
}

interface AvatarModelProps {
  look: AvatarLook;
  /** Animation input. When omitted the avatar idles. */
  poseRef?: RefObject<AvatarPose>;
  /** Extra objects attached to the right hand (cup) or torso (guitar). */
  handItem?: ReactNode;
  chestItem?: ReactNode;
}

/**
 * Procedural low-poly character. Everything is primitives, colored by the
 * avatar config, with a procedural idle, walk, run, sit, wave and talk animation.
 */
export function AvatarModel({ look, poseRef, handItem, chestItem }: AvatarModelProps) {
  const build = BUILD[look.build];

  const materials = useMemo(() => {
    const make = (color: string, roughness = 0.85) =>
      new THREE.MeshStandardMaterial({ color, roughness });
    return {
      skin: make(look.skin, 0.75),
      hair: make(look.hairColor, 0.9),
      top: make(look.topColor),
      bottom: make(look.bottomColor),
      shoe: make(look.shoeColor),
      sole: make(SOLE_COLOR),
      eye: make(EYE_COLOR, 0.4),
    };
  }, [look.skin, look.hairColor, look.topColor, look.bottomColor, look.shoeColor]);

  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  // Random start time so a group of avatars does not idle in sync.
  const [timeOffset] = useState(() => Math.random() * 10);
  const anim = useRef({ phase: 0, time: timeOffset, gait: 0, run: 0 });

  useFrame((_, rawDelta) => {
    if (!body.current) return;
    const delta = Math.min(rawDelta, 0.1);
    const pose = poseRef?.current;
    const state = anim.current;
    const speed = pose?.speed ?? 0;
    const sit = pose?.sit ?? "none";
    const sitting = sit !== "none";

    state.time += delta;
    const targetGait = sitting ? 0 : THREE.MathUtils.clamp(speed / 1.2, 0, 1);
    const targetRun = THREE.MathUtils.clamp((speed - WALK_SPEED_REF) / 2.5, 0, 1);
    state.gait = THREE.MathUtils.damp(state.gait, targetGait, 10, delta);
    state.run = THREE.MathUtils.damp(state.run, targetRun, 8, delta);
    // Step frequency follows ground speed so feet do not slide much.
    state.phase += delta * (4.2 + speed * 1.55) * (state.gait > 0.01 ? 1 : 0);

    const { gait, run, phase, time } = state;
    const swing = Math.sin(phase);
    const legAmp = (0.55 + run * 0.35) * gait;
    const armAmp = (0.45 + run * 0.55) * gait;
    const breathe = Math.sin(time * 1.7) * 0.012;
    const k = 14;
    const damp = (object: THREE.Object3D | null, axis: "x" | "y" | "z", target: number) => {
      if (object)
        object.rotation[axis] = THREE.MathUtils.damp(object.rotation[axis], target, k, delta);
    };

    // Legs.
    let thighL = -swing * legAmp;
    let thighR = swing * legAmp;
    let kneeL = Math.max(0, Math.sin(phase - 0.9)) * (0.9 + run * 0.5) * gait;
    let kneeR = Math.max(0, Math.sin(phase - 0.9 + Math.PI)) * (0.9 + run * 0.5) * gait;
    let hipDrop = 0;
    if (sit === "bench") {
      thighL = thighR = -Math.PI / 2 + 0.05;
      kneeL = kneeR = Math.PI / 2 - 0.1;
      hipDrop = HIP_Y - 0.5;
    } else if (sit === "ground") {
      thighL = -Math.PI / 2 + 0.28;
      thighR = -Math.PI / 2 + 0.12;
      kneeL = 0.5;
      kneeR = 0.2;
      hipDrop = HIP_Y - 0.12;
    }
    damp(legL.current, "x", thighL);
    damp(legR.current, "x", thighR);
    damp(shinL.current, "x", kneeL);
    damp(shinR.current, "x", kneeR);

    // Whole-body bob and lean.
    const bob = Math.abs(Math.cos(phase)) * 0.035 * gait * (1 + run);
    body.current.position.y = THREE.MathUtils.damp(
      body.current.position.y,
      -hipDrop + bob,
      sitting ? 9 : 20,
      delta,
    );
    damp(body.current, "x", run * 0.16 * gait + (sit === "ground" ? -0.12 : 0));
    if (torso.current) {
      torso.current.scale.y = 1 + breathe;
      damp(torso.current, "y", swing * 0.09 * gait);
    }

    // Arms.
    let shoulderL = swing * armAmp;
    let shoulderR = -swing * armAmp;
    let elbowL = -0.18 - gait * 0.25 - run * 0.9;
    let elbowR = elbowL;
    let spreadL = 0.09;
    let spreadR = -0.09;
    if (sitting) {
      shoulderL = shoulderR = -0.45;
      elbowL = elbowR = -0.55;
    }
    if (pose?.playing) {
      shoulderL = -0.75;
      elbowL = -1.25;
      spreadL = -0.25;
      shoulderR = -0.5;
      elbowR = -1.35 + Math.sin(time * 7) * 0.12;
      spreadR = 0.3;
    }
    if (pose?.talking && !pose.playing) {
      shoulderR = -0.35 + Math.sin(time * 2.6) * 0.1;
      elbowR = -1.0 + Math.sin(time * 3.4) * 0.22;
    }
    if (pose?.pointing) {
      shoulderR = -1.45;
      elbowR = -0.05;
      spreadR = -0.15;
    }
    if (pose?.waving) {
      shoulderR = 0;
      spreadR = -2.55 + Math.sin(time * 9) * 0.28;
      elbowR = -0.35;
    }
    damp(armL.current, "x", shoulderL);
    damp(armR.current, "x", shoulderR);
    damp(armL.current, "z", spreadL);
    damp(armR.current, "z", spreadR);
    damp(foreL.current, "x", elbowL);
    damp(foreR.current, "x", elbowR);

    // Head: gentle idle look-around, small nods while talking.
    damp(head.current, "y", sitting || gait > 0.1 ? 0 : Math.sin(time * 0.45) * 0.22);
    damp(head.current, "x", pose?.talking ? Math.sin(time * 4.2) * 0.07 : 0);
  });

  const w = build.width;
  const limb = build.limb;
  const hipX = 0.095 * w;
  const shoulderX = 0.175 * w + 0.05 * limb;
  const armRadius = 0.05 * limb;
  const sleeveMaterial = look.top === "tank" ? materials.skin : materials.top;
  const forearmMaterial =
    look.top === "hoodie" || look.top === "jacket" ? materials.top : materials.skin;
  const thighMaterial = look.bottom === "skirt" ? materials.skin : materials.bottom;
  const shinMaterial = look.bottom === "jeans" ? materials.bottom : materials.skin;

  const leg = (
    side: 1 | -1,
    thighRef: RefObject<THREE.Group | null>,
    shinRef: RefObject<THREE.Group | null>,
  ) => (
    <group ref={thighRef} position={[side * hipX, HIP_Y, 0]}>
      <Segment length={THIGH} radius={0.078 * limb} material={thighMaterial} />
      <group ref={shinRef} position={[0, -THIGH, 0]}>
        <Segment length={SHIN} radius={0.064 * limb} material={shinMaterial} />
        <group position={[0, -SHIN, 0]}>
          <mesh position={[0, -0.005, 0.045]} material={materials.shoe} castShadow>
            <boxGeometry args={[0.105 * limb, 0.075, 0.24]} />
          </mesh>
          <mesh position={[0, -0.05, 0.045]} material={materials.sole}>
            <boxGeometry args={[0.112 * limb, 0.028, 0.25]} />
          </mesh>
          {look.shoes === "boots" && (
            <mesh position={[0, 0.1, 0]} material={materials.shoe} castShadow>
              <cylinderGeometry args={[0.076 * limb, 0.07 * limb, 0.2, 10]} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );

  const arm = (
    side: 1 | -1,
    upperRef: RefObject<THREE.Group | null>,
    lowerRef: RefObject<THREE.Group | null>,
    item?: ReactNode,
  ) => (
    <group ref={upperRef} position={[side * shoulderX, SHOULDER_Y, 0]}>
      <Segment length={UPPER_ARM} radius={armRadius * 1.08} material={sleeveMaterial} />
      <group ref={lowerRef} position={[0, -UPPER_ARM, 0]}>
        <Segment length={FOREARM} radius={armRadius * 0.92} material={forearmMaterial} />
        <group position={[0, -FOREARM - 0.02, 0]}>
          <mesh material={materials.skin} castShadow>
            <sphereGeometry args={[0.046 * limb, 10, 8]} />
          </mesh>
          {item}
        </group>
      </group>
    </group>
  );

  return (
    <group>
      <group ref={body}>
        {leg(1, legL, shinL)}
        {leg(-1, legR, shinR)}

        {/* Pelvis */}
        <mesh
          position={[0, HIP_Y + 0.03, 0]}
          scale={[1, 1, 0.76]}
          material={materials.bottom}
          castShadow
        >
          <cylinderGeometry args={[0.172 * w, 0.165 * w, 0.17, 16]} />
        </mesh>
        {look.bottom === "skirt" && (
          <mesh position={[0, HIP_Y - 0.13, 0]} material={materials.bottom} castShadow>
            <cylinderGeometry args={[0.165 * w, 0.27 * w, 0.36, 14, 1, true]} />
          </mesh>
        )}

        <group ref={torso} position={[0, HIP_Y, 0]}>
          <mesh position={[0, 0.3, 0]} scale={[1.06, 1, 0.68]} material={materials.top} castShadow>
            <capsuleGeometry args={[0.175 * w, 0.27, 6, 18]} />
          </mesh>
          {look.top === "jacket" && (
            <mesh position={[0, 0.3, 0.115 * w]} material={materials.sole}>
              <boxGeometry args={[0.09 * w, 0.44, 0.03]} />
            </mesh>
          )}
          {look.top === "hoodie" && (
            <mesh
              position={[0, 0.56, -0.05]}
              rotation={[1.25, 0, 0]}
              material={materials.top}
              castShadow
            >
              <torusGeometry args={[0.095, 0.045, 8, 14]} />
            </mesh>
          )}
          <group position={[0, 0.3, 0]}>{chestItem}</group>
        </group>

        {arm(1, armL, foreL)}
        {arm(-1, armR, foreR, handItem)}

        {/* Neck and head */}
        <mesh position={[0, SHOULDER_Y + 0.09, 0]} material={materials.skin}>
          <cylinderGeometry args={[0.055 * limb, 0.06 * limb, 0.12, 10]} />
        </mesh>
        <group ref={head} position={[0, HEAD_Y, 0]}>
          <mesh scale={[1, 1.06, 1]} material={materials.skin} castShadow>
            <sphereGeometry args={[HEAD_R, 20, 16]} />
          </mesh>
          <mesh position={[0.048, 0.012, HEAD_R * 0.92]} material={materials.eye}>
            <sphereGeometry args={[0.014, 8, 8]} />
          </mesh>
          <mesh position={[-0.048, 0.012, HEAD_R * 0.92]} material={materials.eye}>
            <sphereGeometry args={[0.014, 8, 8]} />
          </mesh>
          <mesh
            position={[0, -0.014, HEAD_R * 0.99]}
            scale={[0.8, 1.1, 1]}
            material={materials.skin}
          >
            <sphereGeometry args={[0.02, 8, 8]} />
          </mesh>
          <mesh
            position={[0, -0.052, HEAD_R * 0.93]}
            rotation={[0.25, 0, Math.PI]}
            material={materials.eye}
          >
            <torusGeometry args={[0.022, 0.005, 6, 10, Math.PI]} />
          </mesh>
          <Hair style={look.hairStyle} material={materials.hair} />
        </group>
      </group>
    </group>
  );
}
