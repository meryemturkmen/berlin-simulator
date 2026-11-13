"use client";

import { useEffect, type RefObject } from "react";
import { input } from "./input";

const DRAG_SENSITIVITY = 0.0055;

/**
 * Drag on the canvas to orbit the camera (mouse or touch), wheel or pinch to
 * zoom. The joystick stops propagation, so its pointer never reaches this.
 */
export function useLookControls(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;

    const down = (event: PointerEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("[data-ui]")) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      if (pointers.size === 1) {
        input.lookYaw += (event.clientX - previous.x) * DRAG_SENSITIVITY;
        input.lookPitch += (event.clientY - previous.y) * DRAG_SENSITIVITY;
      }
      previous.x = event.clientX;
      previous.y = event.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance > 0) input.zoom += (pinchDistance - distance) * 0.02;
        pinchDistance = distance;
      }
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinchDistance = 0;
    };
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("[data-ui]")) return;
      input.zoom += Math.sign(event.deltaY) * 0.5;
    };

    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("wheel", wheel, { passive: true });
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("wheel", wheel);
    };
  }, [target]);
}
