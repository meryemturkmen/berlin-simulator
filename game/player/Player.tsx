"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AvatarModel, createPose } from "@/game/avatar/AvatarModel";
import type { AvatarLook } from "@/game/avatar/schema";
import { input, readMove, type MoveIntent } from "@/game/input";
import { runtime } from "@/game/runtime";
import { usePlayer, type Seat } from "@/game/store/player";

const WALK_SPEED = 3.4;
const RUN_SPEED = 6.4;
const GRAVITY = 22;
const CAPSULE_HALF_HEIGHT = 0.52;
const CAPSULE_RADIUS = 0.3;
const CAMERA_MIN_DISTANCE = 2.6;
const CAMERA_MAX_DISTANCE = 9;
const CAMERA_HEAD_HEIGHT = 1.45;
const DOWN = { x: 0, y: -1, z: 0 };

/** Frame-rate independent easing of an angle along the shortest arc. */
function dampAngle(current: number, target: number, lambda: number, delta: number): number {
  const difference =
    THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + difference * (1 - Math.exp(-lambda * delta));
}

interface PlayerProps {
  look: AvatarLook;
  spawn: { position: [number, number, number]; heading: number };
  /** Terrain height lookup, used when the player is placed somewhere directly. */
  heightAt: (x: number, z: number) => number;
}

/**
 * Third-person player: a kinematic capsule moved by Rapier's character
 * controller, with a follow camera that orbits on mouse or touch drag and
 * pulls in when geometry gets between it and the player.
 */
export function Player({ look, spawn, heightAt }: PlayerProps) {
  const { world, rapier } = useRapier();
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const viewShift = useRef({ x: 0, y: 0 });
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const poseRef = useRef(createPose());
  const verticalVelocity = useRef(0);
  const hasGround = useRef(false);
  const lastSeat = useRef<Seat | null>(null);
  const smoothedTarget = useRef(new THREE.Vector3());
  const cameraDistance = useRef(runtime.camera.distance);
  const scratch = useMemo(
    () => ({
      move: { x: 0, y: 0, run: false } as MoveIntent,
      desired: new THREE.Vector3(),
      target: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      probe: new THREE.Vector3(),
    }),
    [],
  );

  // Created in an effect (not useMemo) so React Strict Mode's extra
  // mount/unmount cycle never leaves us holding a freed controller.
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  useEffect(() => {
    const instance = world.createCharacterController(0.03);
    instance.enableAutostep(0.35, 0.15, false);
    instance.enableSnapToGround(0.4);
    instance.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(48));
    instance.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(60));
    instance.setApplyImpulsesToDynamicBodies(false);
    controllerRef.current = instance;
    return () => {
      controllerRef.current = null;
      world.removeCharacterController(instance);
    };
  }, [world]);

  // Start each place looking the way the spawn point faces.
  useEffect(() => {
    runtime.player.position.set(...spawn.position);
    runtime.player.heading = spawn.heading;
    runtime.camera.yaw = spawn.heading + Math.PI;
    smoothedTarget.current.set(
      spawn.position[0],
      spawn.position[1] + CAMERA_HEAD_HEIGHT,
      spawn.position[2],
    );
    verticalVelocity.current = 0;
    hasGround.current = false;
    return () => {
      runtime.ready = false;
    };
  }, [spawn]);

  useFrame((_, rawDelta) => {
    const rigidBody = body.current;
    const controller = controllerRef.current;
    if (!rigidBody || !controller || rigidBody.numColliders() === 0) return;
    if (rawDelta > 0) runtime.fps += (1 / rawDelta - runtime.fps) * 0.1;
    // Clamp long hitches (tab switches) but still track slow frames faithfully.
    const delta = Math.min(rawDelta, 0.2);
    const teleport = runtime.teleport;
    if (teleport) {
      runtime.teleport = null;
      usePlayer.getState().stand();
      lastSeat.current = null;
      rigidBody.setTranslation(
        { x: teleport.x, y: heightAt(teleport.x, teleport.z) + 0.2, z: teleport.z },
        true,
      );
      runtime.player.heading = teleport.heading;
      runtime.camera.yaw = teleport.heading + Math.PI;
      verticalVelocity.current = 0;
      runtime.ready = false; // snap the camera instead of gliding there
    }
    const { seat, frozen } = usePlayer.getState();
    const pose = poseRef.current;
    const cam = runtime.camera;
    const move = readMove(scratch.move);
    if (frozen) {
      move.x = 0;
      move.y = 0;
    }

    // Camera input. Strafing also turns the camera a little, so the game is
    // fully steerable from the keyboard.
    cam.yaw -= input.lookYaw;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + input.lookPitch, -0.15, 1.2);
    cam.distance = THREE.MathUtils.clamp(
      cam.distance + input.zoom,
      CAMERA_MIN_DISTANCE,
      CAMERA_MAX_DISTANCE,
    );
    input.lookYaw = 0;
    input.lookPitch = 0;
    input.zoom = 0;
    if (!seat) cam.yaw -= move.x * 1.1 * delta;

    // In a conversation: face the other person, camera over the shoulder.
    const focus = runtime.focus;
    if (focus) {
      const toFocus = Math.atan2(
        focus.x - runtime.player.position.x,
        focus.z - runtime.player.position.z,
      );
      if (!seat) runtime.player.heading = dampAngle(runtime.player.heading, toFocus, 8, delta);
      cam.yaw = dampAngle(cam.yaw, toFocus + Math.PI + 0.55, 5, delta);
      cam.pitch = THREE.MathUtils.damp(cam.pitch, 0.16, 5, delta);
      cam.distance = THREE.MathUtils.damp(cam.distance, 4.4, 5, delta);
    }

    const position = rigidBody.translation();
    let nextX = position.x;
    let nextY = position.y;
    let nextZ = position.z;

    // Standing up: step clear of the seat so the capsule is not left inside it.
    if (!seat && lastSeat.current) {
      nextX += Math.sin(lastSeat.current.heading) * 0.75;
      nextZ += Math.cos(lastSeat.current.heading) * 0.75;
    }
    lastSeat.current = seat;

    // Probe the ground below. Until the scene's colliders exist there is
    // nothing to stand on, so gravity waits; afterwards the probe also lifts
    // the player back up should they ever end up below the surface.
    scratch.probe.set(nextX, nextY + 1, nextZ);
    const below = world.castRay(
      new rapier.Ray(scratch.probe, DOWN),
      6,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      rigidBody,
    );
    const groundY = below ? nextY + 1 - below.timeOfImpact : null;
    if (groundY !== null) hasGround.current = true;

    if (seat) {
      // Any movement input gets the player back up.
      if (Math.hypot(move.x, move.y) > 0.3 && !frozen) {
        usePlayer.getState().stand();
      }
      [nextX, nextY, nextZ] = seat.position;
      runtime.player.heading = seat.heading;
      runtime.player.speed = 0;
      pose.speed = 0;
      pose.sit = seat.mode;
      verticalVelocity.current = 0;
    } else {
      pose.sit = "none";
      const strength = Math.hypot(move.x, move.y);
      const speed = strength * (move.run ? RUN_SPEED : WALK_SPEED);
      // Camera-relative direction on the ground plane.
      const sin = Math.sin(cam.yaw);
      const cos = Math.cos(cam.yaw);
      const dirX = strength > 0 ? (move.x * cos - move.y * sin) / strength : 0;
      const dirZ = strength > 0 ? (-move.x * sin - move.y * cos) / strength : 0;

      // One swept move per frame: the controller shape-casts the whole
      // displacement, so slow frames cover the right distance without tunneling.
      verticalVelocity.current = hasGround.current
        ? Math.max(verticalVelocity.current - GRAVITY * delta, -30)
        : 0;
      scratch.desired.set(
        dirX * speed * delta,
        verticalVelocity.current * delta,
        dirZ * speed * delta,
      );
      controller.computeColliderMovement(
        rigidBody.collider(0),
        scratch.desired,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      );
      const moved = controller.computedMovement();
      const grounded = controller.computedGrounded();
      if (grounded) verticalVelocity.current = 0;

      nextX += moved.x;
      nextY += moved.y;
      nextZ += moved.z;

      if (groundY !== null && nextY < groundY - 0.05) {
        nextY = groundY;
        verticalVelocity.current = 0;
      }
      // Safety net: never leave the player falling forever.
      if (nextY < -30) {
        [nextX, nextY, nextZ] = spawn.position;
        verticalVelocity.current = 0;
      }

      const actualSpeed = Math.hypot(moved.x, moved.z) / delta;
      runtime.player.speed = actualSpeed;
      runtime.player.grounded = grounded;
      pose.speed = THREE.MathUtils.damp(pose.speed, actualSpeed, 12, delta);
      if (strength > 0.05) {
        const targetHeading = Math.atan2(dirX, dirZ);
        const difference =
          THREE.MathUtils.euclideanModulo(
            targetHeading - runtime.player.heading + Math.PI,
            Math.PI * 2,
          ) - Math.PI;
        runtime.player.heading += difference * Math.min(1, delta * 12);
      }
    }

    rigidBody.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
    runtime.player.position.set(nextX, nextY, nextZ);
    if (visual.current) visual.current.rotation.y = runtime.player.heading;

    // Follow camera.
    scratch.target.set(nextX, nextY + (seat ? 0.95 : CAMERA_HEAD_HEIGHT), nextZ);
    if (!runtime.ready) smoothedTarget.current.copy(scratch.target);
    smoothedTarget.current.lerp(scratch.target, 1 - Math.exp(-delta * 14));
    scratch.offset
      .set(
        Math.sin(cam.yaw) * Math.cos(cam.pitch),
        Math.sin(cam.pitch),
        Math.cos(cam.yaw) * Math.cos(cam.pitch),
      )
      .normalize();

    // Pull the camera in front of anything that blocks the view.
    let allowed = cam.distance;
    const hit = world.castRay(
      new rapier.Ray(smoothedTarget.current, scratch.offset),
      cam.distance + 0.3,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      rigidBody,
    );
    if (hit) allowed = Math.max(0.6, hit.timeOfImpact - 0.3);
    // Snap in quickly, ease back out slowly.
    cameraDistance.current =
      allowed < cameraDistance.current
        ? allowed
        : THREE.MathUtils.damp(cameraDistance.current, allowed, 4, delta);

    camera.position
      .copy(smoothedTarget.current)
      .addScaledVector(scratch.offset, cameraDistance.current);
    camera.lookAt(smoothedTarget.current);

    // Keep the action visible next to (or above) an open panel.
    const shift = viewShift.current;
    shift.x = THREE.MathUtils.damp(shift.x, runtime.viewShift.x, 6, delta);
    shift.y = THREE.MathUtils.damp(shift.y, runtime.viewShift.y, 6, delta);
    if (Math.abs(shift.x) > 0.002 || Math.abs(shift.y) > 0.002) {
      (camera as THREE.PerspectiveCamera).setViewOffset(
        size.width,
        size.height,
        shift.x * size.width,
        shift.y * size.height,
        size.width,
        size.height,
      );
    } else if ((camera as THREE.PerspectiveCamera).view?.enabled) {
      (camera as THREE.PerspectiveCamera).clearViewOffset();
    }
    runtime.ready = true;
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={spawn.position}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider
        args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]}
        position={[0, CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS, 0]}
      />
      <group ref={visual} scale={0.94}>
        <AvatarModel look={look} poseRef={poseRef} />
      </group>
    </RigidBody>
  );
}
