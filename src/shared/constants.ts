export const SERVER_PORT = 2567;
export const TICK_RATE = 30;
export const MOVE_SPEED = 4;
export const MAX_PLAYERS = 8;


// Shared obstacle definitions for client rendering and server collision
// Format: [x, z, width, depth]
export const OBSTACLES: [number, number, number, number][] = [
  [5, 5, 4, 4],
  [-5, -5, 4, 4],
  [5, -5, 4, 4],
  [-5, 5, 4, 4],
  [0, 10, 8, 2],
  [0, -10, 8, 2],
];
