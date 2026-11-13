"use client";

import type { PlaceProp } from "@/lib/places/schema";

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

/** Hand-placed set dressing from the place definition. */
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
        </group>
      ))}
    </>
  );
}
