import { MOVE_SPEED, OBSTACLES } from "./constants.js";

export function checkCollision(x: number, z: number): boolean {
  const playerRadius = 0.5;
  for (const [ox, oz, ow, od] of OBSTACLES) {
    const closestX = Math.max(ox - ow / 2, Math.min(x, ox + ow / 2));
    const closestZ = Math.max(oz - od / 2, Math.min(z, oz + od / 2));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < playerRadius * playerRadius) {
      return true; // Collision detected
    }
  }
  return false;
}

export function applyMovement(
  x: number,
  z: number,
  inputX: number,
  inputZ: number,
  dt: number
): { x: number; z: number } {
  const nextX = x + inputX * MOVE_SPEED * dt;
  const nextZ = z + inputZ * MOVE_SPEED * dt;

  // Check X axis movement
  if (!checkCollision(nextX, z)) {
    x = nextX;
  }
  // Check Z axis movement
  if (!checkCollision(x, nextZ)) {
    z = nextZ;
  }

  return { x, z };
}
