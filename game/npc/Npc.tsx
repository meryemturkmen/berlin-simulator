"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AvatarModel, createPose } from "@/game/avatar/AvatarModel";
import { registerInteractables } from "@/game/interact/registry";
import { runtime } from "@/game/runtime";
import { useChat } from "@/game/store/chat";
import { npcState, useNpcs } from "@/game/store/npcs";
import type { Emotion, Npc as NpcDefinition } from "@/lib/npc/schema";
import type { NpcSpot } from "@/lib/places/schema";
import { Dog, Guitar } from "./Companions";

const EMOJI: Record<Emotion, string> = {
  neutral: "",
  happy: "😊",
  annoyed: "😒",
  surprised: "😮",
  thoughtful: "🤔",
};
const ACTION_EMOJI: Record<string, string> = {
  play_song: "🎶",
  pet_dog: "🐾",
  serve_matcha: "🍵",
  serve_coffee: "☕",
  take_photo: "📸",
  wave: "👋",
};

function Label({ npc }: { npc: NpcDefinition }) {
  const live = useNpcs((store) => store.states[npc.id]);
  const chatting = useChat((state) => state.npc?.id === npc.id);
  const action = live?.action?.id ?? null;
  const emoji =
    (action && ACTION_EMOJI[action]) || (live?.talking ? "💬" : EMOJI[live?.emotion ?? "neutral"]);

  return (
    <div className="pointer-events-none flex -translate-y-full flex-col items-center gap-1 select-none">
      {emoji && (
        <span
          data-testid={`npc-emotion-${npc.id}`}
          className="rounded-full bg-white/95 px-2 py-0.5 text-2xl shadow-md"
          aria-hidden="true"
        >
          {emoji}
        </span>
      )}
      {!chatting && (
        <span className="bg-ink/70 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap text-white">
          {npc.name}
        </span>
      )}
    </div>
  );
}

interface NpcProps {
  npc: NpcDefinition;
  spot: NpcSpot;
  y: number;
}

/**
 * A person you can talk to: the shared avatar model with the NPC's look, a
 * resting pose from the place definition, and reactions (emotion bubble,
 * waving, pointing, playing) driven by the chat.
 */
export function Npc({ npc, spot, y }: NpcProps) {
  const group = useRef<THREE.Group>(null);
  const poseRef = useRef(
    createPose({
      sit: spot.pose === "sit_ground" ? "ground" : spot.pose === "sit_bench" ? "bench" : "none",
      playing: spot.pose === "play_guitar",
    }),
  );

  useEffect(
    () =>
      registerInteractables([
        {
          id: `npc-${npc.id}`,
          position: [spot.x, y, spot.z],
          radius: 3,
          label: "interact.talk",
          name: npc.name,
          priority: 2,
          onInteract: () => void useChat.getState().open(npc.id),
        },
      ]),
    [npc, spot, y],
  );

  useFrame((_, delta) => {
    const live = npcState(npc.id);
    const pose = poseRef.current;
    const action = live.action && performance.now() < live.action.until ? live.action.id : null;
    pose.talking = live.talking;
    pose.waving = action === "wave";
    pose.pointing = action === "point_to_place" || action === "show_window";
    // A guitarist strums idly and plays properly during a song.
    pose.playing = spot.pose === "play_guitar" && (action === "play_song" || !live.talking);

    if (!group.current) return;
    // Standing characters turn to whoever they are talking to.
    const chatting = useChat.getState().npc?.id === npc.id;
    let target = spot.heading;
    if (chatting && spot.pose !== "sit_bench") {
      target = Math.atan2(runtime.player.position.x - spot.x, runtime.player.position.z - spot.z);
    }
    const current = group.current.rotation.y;
    const difference =
      THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
    group.current.rotation.y = current + difference * Math.min(1, delta * 5);
  });

  const seated = spot.pose === "sit_ground" || spot.pose === "sit_bench";
  return (
    <>
      <group
        ref={group}
        position={[spot.x, y, spot.z]}
        rotation={[0, spot.heading, 0]}
        scale={0.94}
      >
        <AvatarModel
          look={npc.appearance}
          poseRef={poseRef}
          chestItem={spot.pose === "play_guitar" ? <Guitar /> : undefined}
        />
        <Html
          position={[0, seated ? 1.45 : 2.2, 0]}
          center
          zIndexRange={[20, 0]}
          distanceFactor={9}
        >
          <Label npc={npc} />
        </Html>
      </group>
      {spot.companion === "dog" && (
        <group
          position={[
            spot.x + Math.cos(spot.heading) * 0.75,
            y,
            spot.z - Math.sin(spot.heading) * 0.75,
          ]}
          rotation={[0, spot.heading, 0]}
        >
          <Dog ownerId={npc.id} />
        </group>
      )}
      <RigidBody type="fixed" colliders={false} position={[spot.x, y, spot.z]}>
        <CapsuleCollider
          args={[seated ? 0.25 : 0.5, 0.35]}
          position={[0, seated ? 0.6 : 0.85, 0]}
        />
      </RigidBody>
    </>
  );
}
