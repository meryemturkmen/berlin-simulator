"use client";

import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { use } from "react";
import * as THREE from "three";
import { manifestSchema, type PlaceManifest } from "@/lib/places/schema";

const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const manifests = new Map<string, Promise<PlaceManifest>>();

export function placeGlbUrl(id: string): string {
  return `/assets/places/${id}.glb`;
}

function loadManifest(id: string): Promise<PlaceManifest> {
  let promise = manifests.get(id);
  if (!promise) {
    promise = fetch(`/assets/places/${id}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest for ${id} failed: ${response.status}`);
        return response.json();
      })
      .then((json) => manifestSchema.parse(json));
    manifests.set(id, promise);
  }
  return promise;
}

/** Starts downloading a place's assets without rendering it (used by the map). */
export function preloadPlace(id: string) {
  void loadManifest(id);
  // Meshopt decoding ships with drei; no Draco decoder download needed.
  useGLTF.preload(placeGlbUrl(id), false, true);
}

/** Suspends until the place's GLB and manifest are loaded. */
export function usePlaceAssets(id: string) {
  const manifest = use(loadManifest(id));
  const gltf = useGLTF(placeGlbUrl(id), false, true);
  // The aerial photo is optional: places built without it keep their drawn ground.
  const aerial = useLoader(
    THREE.TextureLoader,
    manifest.aerial ? `/assets/places/${id}-ground.jpg` : BLANK_PIXEL,
    undefined,
  );
  return { manifest, scene: gltf.scene, aerial: manifest.aerial ? aerial : null };
}
