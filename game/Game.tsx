"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Hud } from "@/components/hud/Hud";
import { LoadingScreen } from "@/components/hud/LoadingScreen";
import { getPlace, PLACES } from "@/content/places";
import { terrainHeight } from "@/lib/places/terrain";
import { useKeyboardInput } from "./input";
import { Player } from "./player/Player";
import { installDebugProbe, setDebugPlace, setDebugQuality } from "./runtime";
import { DayNight } from "./sky/DayNight";
import { useProfile } from "./store/profile";
import { useWorld } from "./store/world";
import { useLookControls } from "./useLookControls";
import { useQuality } from "./useQuality";

// The scene code is its own chunk; each place's GLB and manifest load on demand.
const PlaceScene = dynamic(() => import("./place/PlaceScene"), { ssr: false });

export default function Game() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const quality = useQuality();
  const status = useProfile((state) => state.status);
  const avatar = useProfile((state) => state.avatar);
  const hydrate = useProfile((state) => state.hydrate);
  const placeId = useWorld((state) => state.placeId);
  const phase = useWorld((state) => state.phase);
  const factIndex = useWorld((state) => state.factIndex);
  const markReady = useWorld((state) => state.markReady);
  const place = getPlace(placeId) ?? PLACES[0];

  useKeyboardInput();
  useLookControls(root);

  useEffect(() => {
    installDebugProbe();
    void hydrate();
  }, [hydrate]);

  useEffect(() => setDebugQuality(quality.level), [quality.level]);

  // No avatar yet: send the player to the editor first.
  useEffect(() => {
    if (status === "ready" && !avatar) router.replace("/avatar");
  }, [status, avatar, router]);

  const heightAt = useCallback(
    (x: number, z: number) => terrainHeight(place.terrain, x, z),
    [place.terrain],
  );
  const spawn = useMemo(
    () => ({
      position: [
        place.spawn.x,
        terrainHeight(place.terrain, place.spawn.x, place.spawn.z) + 0.3,
        place.spawn.z,
      ] as [number, number, number],
      heading: place.spawn.heading,
    }),
    [place],
  );

  // `?hour=20.2` pins the starting time of day (screenshots and tests).
  const startHour = useMemo(() => {
    const value = Number.parseFloat(new URLSearchParams(window.location.search).get("hour") ?? "");
    return Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 24) : null;
  }, []);

  const onReady = useCallback(() => {
    setDebugPlace(place.id);
    markReady();
  }, [place.id, markReady]);

  return (
    <div ref={root} className="game-root bg-dusk" data-testid="game-root">
      {avatar && (
        // Remount on a quality change: shadow support is fixed when the renderer starts.
        <Canvas
          key={quality.level}
          shadows={quality.shadowMapSize > 0}
          flat
          camera={{ position: [0, 3, 8], fov: 55, near: 0.3, far: 700 }}
          dpr={[1, quality.maxPixelRatio]}
        >
          <DayNight
            key={place.id}
            startHour={startHour ?? place.startHour}
            shadowMapSize={quality.shadowMapSize}
            clouds={quality.clouds}
            fogFar={place.halfSize + place.backdrop + 160}
          />
          <Suspense fallback={null}>
            <Physics timeStep="vary" key={place.id}>
              <PlaceScene
                place={place}
                shadows={quality.shadowMapSize > 0}
                treeDensity={quality.treeDensity}
                onReady={onReady}
              />
              <Player look={avatar} spawn={spawn} heightAt={heightAt} />
            </Physics>
          </Suspense>
        </Canvas>
      )}

      {phase === "playing" && <Hud place={place} />}
      <LoadingScreen place={place} factIndex={factIndex} visible={phase === "loading"} />
    </div>
  );
}
