"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { daylight } from "@/game/sky/daylight";
import type { Place, PlaceProp } from "@/lib/places/schema";

type HeightAt = (x: number, z: number) => number;

function Blanket({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[2.3, 0.03, 1.7]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {[-0.75, 0, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.038, 0]}>
          <boxGeometry args={[0.16, 0.01, 1.7]} />
          <meshStandardMaterial color="#f7f0e3" roughness={1} />
        </mesh>
      ))}
      {/* Picnic basket */}
      <mesh position={[0.78, 0.17, -0.5]} castShadow>
        <boxGeometry args={[0.42, 0.26, 0.3]} />
        <meshStandardMaterial color="#b98a52" roughness={0.9} />
      </mesh>
      <mesh position={[0.78, 0.33, -0.5]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.13, 0.015, 6, 12, Math.PI]} />
        <meshStandardMaterial color="#8c6238" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Chair({ x, facing }: { x: number; facing: number }) {
  return (
    <group position={[x, 0, 0]} rotation={[0, facing, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.42, 0.04, 0.42]} />
        <meshStandardMaterial color="#c98f4e" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.72, -0.2]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.04]} />
        <meshStandardMaterial color="#c98f4e" roughness={0.8} />
      </mesh>
      {[
        [0.18, 0.18],
        [-0.18, 0.18],
        [0.18, -0.18],
        [-0.18, -0.18],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[lx, 0.22, lz]}>
          <cylinderGeometry args={[0.018, 0.018, 0.44, 6]} />
          <meshStandardMaterial color="#3a3c44" />
        </mesh>
      ))}
    </group>
  );
}

/** Bistro table with a chair on either side (along local X). */
function CafeTable() {
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.035, 20]} />
        <meshStandardMaterial color="#f1ead9" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.74, 8]} />
        <meshStandardMaterial color="#3a3c44" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.04, 14]} />
        <meshStandardMaterial color="#3a3c44" />
      </mesh>
      <Chair x={0.75} facing={-Math.PI / 2} />
      <Chair x={-0.75} facing={Math.PI / 2} />
    </group>
  );
}

function Parasol({ color }: { color: string }) {
  return (
    <group position={[0.05, 0, -0.55]}>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 2.5, 6]} />
        <meshStandardMaterial color="#e8e2d6" />
      </mesh>
      <mesh position={[0, 2.45, 0]} castShadow>
        <coneGeometry args={[1.5, 0.5, 8, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} flatShading />
      </mesh>
    </group>
  );
}

function Planter() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.6, 0.6]} />
        <meshStandardMaterial color="#8d857c" roughness={1} />
      </mesh>
      {[-0.4, 0, 0.4].map((x, index) => (
        <mesh key={x} position={[x, 0.78 + (index % 2) * 0.06, 0]} castShadow>
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color={index === 1 ? "#6aa457" : "#7cb35c"} flatShading />
        </mesh>
      ))}
      {[-0.5, -0.15, 0.2, 0.5].map((x, index) => (
        <mesh key={x} position={[x, 0.95, 0.12 - (index % 2) * 0.24]}>
          <sphereGeometry args={[0.07, 6, 5]} />
          <meshStandardMaterial color={["#e4604a", "#f3b95f", "#e59ab4", "#f4efe6"][index]} />
        </mesh>
      ))}
    </group>
  );
}

/** Builds a canvas texture with one line of lettering. */
function useSignTexture(text: string, background: string, foreground = "#fdf8ec") {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 160;
    const context = canvas.getContext("2d")!;
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = foreground;
    context.textAlign = "center";
    context.textBaseline = "middle";
    let size = 92;
    do {
      context.font = `600 ${size}px Georgia, "Times New Roman", serif`;
      size -= 4;
    } while (context.measureText(text).width > canvas.width - 80 && size > 30);
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [text, background, foreground]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** A small coffee counter with a striped roof and a menu board. */
function MarketStall({ color, text }: { color: string; text: string }) {
  const sign = useSignTexture(text, color);
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 1, 0.7]} />
        <meshStandardMaterial color="#e9dcc3" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[2.75, 0.06, 0.85]} />
        <meshStandardMaterial color="#a8703f" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.55, 0.356]}>
        <planeGeometry args={[2.3, 0.36]} />
        <meshStandardMaterial map={sign} roughness={0.9} />
      </mesh>
      {/* Espresso machine, cups */}
      <mesh position={[-0.75, 1.27, -0.05]} castShadow>
        <boxGeometry args={[0.6, 0.42, 0.42]} />
        <meshStandardMaterial color="#c9ccd2" roughness={0.3} metalness={0.5} />
      </mesh>
      {[0.3, 0.52, 0.74].map((x) => (
        <mesh key={x} position={[x, 1.11, 0.1]}>
          <cylinderGeometry args={[0.05, 0.04, 0.11, 10]} />
          <meshStandardMaterial color="#f7f3ea" />
        </mesh>
      ))}
      {[-1.25, 1.25].map((x) => (
        <mesh key={x} position={[x, 1.2, -0.3]}>
          <cylinderGeometry args={[0.03, 0.03, 2.4, 6]} />
          <meshStandardMaterial color="#3a3c44" />
        </mesh>
      ))}
      <mesh position={[0, 2.45, 0.1]} rotation={[0.22, 0, 0]} castShadow>
        <boxGeometry args={[3, 0.06, 1.5]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Hand-placed set dressing from the place definition. Benches are drawn with the instanced ones. */
export function Props({ props, heightAt }: { props: PlaceProp[]; heightAt: HeightAt }) {
  return (
    <>
      {props.map((prop, index) => (
        <group
          key={`${prop.type}-${index}`}
          position={[prop.x, heightAt(prop.x, prop.z), prop.z]}
          rotation={[0, prop.rotation, 0]}
        >
          {prop.type === "blanket" && <Blanket color={prop.color ?? "#e4604a"} />}
          {prop.type === "cafe_table" && <CafeTable />}
          {prop.type === "parasol" && <Parasol color={prop.color ?? "#e4604a"} />}
          {prop.type === "planter" && <Planter />}
          {prop.type === "market_stall" && (
            <MarketStall color={prop.color ?? "#2f5d62"} text={prop.text ?? ""} />
          )}
        </group>
      ))}
    </>
  );
}

const SHOP_WIDTH = 8;

function ShopFront({
  shop,
  placement,
}: {
  shop: Place["shops"][number];
  placement: [number, number, number];
}) {
  const sign = useSignTexture(shop.name, shop.color);
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#3d4b5a",
        roughness: 0.2,
        emissive: "#ffd9a0",
        emissiveIntensity: 0,
      }),
    [],
  );
  useEffect(() => {
    // Shop windows glow after dark.
    const timer = window.setInterval(() => {
      glass.emissiveIntensity = daylight.uniforms.uNight.value * 0.9;
    }, 500);
    return () => {
      window.clearInterval(timer);
      glass.dispose();
    };
  }, [glass]);

  return (
    <group position={[placement[0], 0, placement[1]]} rotation={[0, placement[2], 0]}>
      {/* Frame, windows, door */}
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[SHOP_WIDTH, 3.5, 0.16]} />
        <meshStandardMaterial color="#f3ead9" roughness={0.9} />
      </mesh>
      {[-2.5, 2.5].map((x) => (
        <mesh key={x} position={[x, 1.55, 0.09]} material={glass}>
          <planeGeometry args={[2.5, 2.1]} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, 0.09]}>
        <planeGeometry args={[1.2, 2.4]} />
        <meshStandardMaterial color={shop.color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.15, 0.1]}>
        <planeGeometry args={[SHOP_WIDTH - 0.6, 0.62]} />
        <meshStandardMaterial map={sign} roughness={0.8} />
      </mesh>
      {shop.awning && (
        <mesh position={[0, 2.72, 0.75]} rotation={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[SHOP_WIDTH - 0.4, 0.05, 1.5]} />
          <meshStandardMaterial color={shop.color} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

/** Shop fronts with invented names, set flush against existing building walls. */
export function Shops({
  shops,
  placements,
}: {
  shops: Place["shops"];
  /** Wall-snapped positions from the asset pipeline (x, z, heading). */
  placements: [number, number, number][];
}) {
  return (
    <>
      {shops.map((shop, index) => (
        <ShopFront
          key={shop.name}
          shop={shop}
          placement={placements[index] ?? [shop.x, shop.z, shop.heading]}
        />
      ))}
    </>
  );
}
