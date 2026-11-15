"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from "@react-three/rapier";
import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  findInteractable,
  registerInteractables,
  useInteraction,
  type Interactable,
} from "@/game/interact/registry";
import { runtime } from "@/game/runtime";
import { useAlbum } from "@/game/store/album";
import { usePlayer } from "@/game/store/player";
import type { Place } from "@/lib/places/schema";
import { terrainHeight } from "@/lib/places/terrain";
import { getNpc } from "@/content/npcs";
import { Npc } from "@/game/npc/Npc";
import { Pedestrians } from "@/game/npc/Pedestrians";
import { createPlaceMaterials } from "./materials";
import { Props, Shops } from "./Props";
import { Benches, Lamps, Trees } from "./Scenery";
import { usePlaceAssets } from "./usePlaceAssets";

const WALL_HEIGHT = 12;

/** World-space triangle soup for a Rapier trimesh, robust to quantized GLB attributes. */
function trimeshArgs(mesh: THREE.Mesh): [Float32Array, Uint32Array] {
  mesh.updateWorldMatrix(true, false);
  const attribute = mesh.geometry.getAttribute("position");
  const vertices = new Float32Array(attribute.count * 3);
  const vertex = new THREE.Vector3();
  for (let index = 0; index < attribute.count; index++) {
    vertex.fromBufferAttribute(attribute, index).applyMatrix4(mesh.matrixWorld);
    vertices.set([vertex.x, vertex.y, vertex.z], index * 3);
  }
  const index = mesh.geometry.index;
  const indices = index
    ? Uint32Array.from(index.array)
    : Uint32Array.from({ length: attribute.count }, (_, i) => i);
  return [vertices, indices];
}

interface PlaceSceneProps {
  place: Place;
  shadows: boolean;
  /** Fraction of scenery trees to draw (trees with colliders are always kept). */
  treeDensity: number;
  /** Number of background pedestrians. */
  crowd: number;
  onReady: () => void;
}

/**
 * One playable place: the pipeline-built GLB (buildings, ground, layers) with
 * runtime materials, instanced trees, benches and lamps, static colliders,
 * invisible walls around the walkable square, and seat interactions.
 */
export default function PlaceScene({
  place,
  shadows,
  treeDensity,
  crowd,
  onReady,
}: PlaceSceneProps) {
  const { manifest, scene, aerial } = usePlaceAssets(place.id);
  const heightAt = useCallback(
    (x: number, z: number) => terrainHeight(place.terrain, x, z),
    [place.terrain],
  );

  const { colliders } = useMemo(() => {
    const { materials, renderOrder, hidden } = createPlaceMaterials(
      aerial ? { texture: aerial, extent: manifest.extent } : undefined,
    );
    const colliders: [Float32Array, Uint32Array][] = [];
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const name = object.name in materials ? object.name : (object.parent?.name ?? "");
      object.material = materials[name] ?? materials.ground;
      object.renderOrder = renderOrder[name] ?? 0;
      object.visible = !hidden.includes(name);
      object.receiveShadow = true;
      object.castShadow = name === "buildings";
      if (name === "ground" || name === "buildings") colliders.push(trimeshArgs(object));
    });
    return { colliders };
  }, [scene, aerial, manifest.extent]);

  const half = manifest.halfSize;
  const nearTrees = useMemo(
    () => manifest.trees.filter(([x, z]) => Math.abs(x) < half + 4 && Math.abs(z) < half + 4),
    [manifest.trees, half],
  );
  // Lower quality thins out the backdrop; everything inside the walkable area stays.
  const drawnTrees = useMemo(
    () =>
      treeDensity >= 1
        ? manifest.trees
        : manifest.trees.filter(
            ([x, z], index) =>
              (Math.abs(x) < half + 4 && Math.abs(z) < half + 4) ||
              (index * 7919) % 100 < treeDensity * 100,
          ),
    [manifest.trees, half, treeDensity],
  );
  // Mapped benches in reach plus benches placed by hand in the place definition.
  const allBenches = useMemo(
    () => [
      ...manifest.benches,
      ...place.props
        .filter((prop) => prop.type === "bench")
        .map((prop): [number, number, number] => [prop.x, prop.z, prop.rotation]),
    ],
    [manifest.benches, place.props],
  );
  const nearBenches = useMemo(
    () => allBenches.filter(([x, z]) => Math.abs(x) < half && Math.abs(z) < half),
    [allBenches, half],
  );

  // Seats: every bench in reach plus the extra seats (picnic blankets) of the place.
  useEffect(() => {
    const seats: Interactable[] = [
      ...nearBenches.map(([x, z, heading], index): Interactable => {
        const y = heightAt(x, z);
        return {
          id: `bench-${index}`,
          position: [x, y, z],
          radius: 1.8,
          label: "interact.sit",
          priority: 1,
          onInteract: () => {
            // Sit on the right half so someone can already be sitting on the left.
            usePlayer.getState().sit({
              id: `bench-${index}`,
              position: [
                x + Math.sin(heading) * 0.06 + Math.cos(heading) * 0.42,
                y,
                z + Math.cos(heading) * 0.06 - Math.sin(heading) * 0.42,
              ],
              heading,
              mode: "bench",
            });
            if (place.benchExperience) useAlbum.getState().unlock(place.benchExperience);
          },
        };
      }),
      ...place.seats.map((seat): Interactable => {
        const y = heightAt(seat.x, seat.z);
        return {
          id: seat.id,
          position: [seat.x, y, seat.z],
          radius: 2,
          label: "interact.sit",
          priority: 1,
          onInteract: () => {
            usePlayer.getState().sit({
              id: seat.id,
              position: [seat.x, y + (seat.mode === "ground" ? 0.04 : 0), seat.z],
              heading: seat.heading,
              mode: seat.mode,
            });
            if (seat.experience) useAlbum.getState().unlock(seat.experience);
          },
        };
      }),
    ];
    return registerInteractables(seats);
  }, [nearBenches, place.seats, place.benchExperience, heightAt]);

  useEffect(() => {
    onReady();
    return () => {
      usePlayer.getState().stand();
      useInteraction.getState().setActive(null);
    };
  }, [onReady]);

  // Keep the HUD prompt in sync with whatever is in reach.
  useFrame(() => {
    const { seat, frozen, seatRequest } = usePlayer.getState();
    const { x, y, z } = runtime.player.position;
    // An NPC invited the player to sit somewhere (e.g. on a picnic blanket).
    if (seatRequest) {
      usePlayer.getState().requestSeat(null);
      const invited = place.seats.find((candidate) => candidate.id === seatRequest);
      if (invited) {
        usePlayer.getState().sit({
          id: invited.id,
          position: [
            invited.x,
            heightAt(invited.x, invited.z) + (invited.mode === "ground" ? 0.04 : 0),
            invited.z,
          ],
          heading: invited.heading,
          mode: invited.mode,
        });
      }
    }
    const next = seat || frozen ? null : findInteractable(x, y, z);
    if (next?.id !== useInteraction.getState().active?.id) {
      useInteraction.getState().setActive(next);
    }
  });

  return (
    <>
      <primitive object={scene} />
      <Trees trees={drawnTrees} palette={place.palette} heightAt={heightAt} castShadow={shadows} />
      <Benches benches={allBenches} heightAt={heightAt} />
      <Lamps lamps={manifest.lamps} heightAt={heightAt} />
      <Props props={place.props} heightAt={heightAt} />
      <Pedestrians
        walkways={manifest.walkways}
        count={crowd}
        heightAt={heightAt}
        seed={place.id.length * 7919}
      />
      <Shops shops={place.shops} placements={manifest.shops} />
      {place.npcs.map((spot) => {
        const npc = getNpc(spot.npc);
        return npc ? (
          <Npc key={spot.npc} npc={npc} spot={spot} y={heightAt(spot.x, spot.z)} />
        ) : null;
      })}

      <RigidBody type="fixed" colliders={false}>
        {colliders.map((args, index) => (
          <TrimeshCollider key={index} args={args} />
        ))}
        {/* Invisible walls around the walkable square. */}
        <CuboidCollider
          args={[half, WALL_HEIGHT, 0.5]}
          position={[0, WALL_HEIGHT - 6, -half - 0.5]}
        />
        <CuboidCollider
          args={[half, WALL_HEIGHT, 0.5]}
          position={[0, WALL_HEIGHT - 6, half + 0.5]}
        />
        <CuboidCollider
          args={[0.5, WALL_HEIGHT, half]}
          position={[-half - 0.5, WALL_HEIGHT - 6, 0]}
        />
        <CuboidCollider
          args={[0.5, WALL_HEIGHT, half]}
          position={[half + 0.5, WALL_HEIGHT - 6, 0]}
        />
        {nearTrees.map(([x, z, size], index) => (
          <CylinderCollider
            key={`tree-${index}`}
            args={[1.5, 0.28 * size]}
            position={[x, heightAt(x, z) + 1.5, z]}
          />
        ))}
        {nearBenches.map(([x, z, heading], index) => (
          <CuboidCollider
            key={`bench-${index}`}
            args={[0.85, 0.42, 0.3]}
            position={[x, heightAt(x, z) + 0.42, z]}
            rotation={[0, heading, 0]}
          />
        ))}
      </RigidBody>
    </>
  );
}
