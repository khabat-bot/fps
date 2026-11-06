import { MOVE_SPEED } from "./constants.js";

export function applyMovement(
  x: number,
  z: number,
  inputX: number,
  inputZ: number,
  dt: number
): { x: number; z: number } {
  return {
    x: x + inputX * MOVE_SPEED * dt,
    z: z + inputZ * MOVE_SPEED * dt,
  };
}
