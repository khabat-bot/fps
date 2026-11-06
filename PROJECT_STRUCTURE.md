# Project Structure

This document provides a high-level overview of the codebase for AI assistants and new developers.

## Root Directory
- `package.json` / `tsconfig.json` / `vite.config.ts`: Project configuration, dependencies, and build scripts.
- `index.html`: Entry point for the Vite client, contains UI overlays (crosshair, fire button, zones).
- `TODO.md`: Mandatory task tracker. Read this first to understand current progress.
- `AGENTS.md`: Master rulebook for AI behavior, tech stack constraints, and architecture rules.
- `PROJECT_STRUCTURE.md`: This file.

## `src/shared/` (Authoritative Logic)
Code that runs identically on both client and server to ensure prediction matches reality.
- `constants.ts`: Tuning values (TICK_RATE, MOVE_SPEED, MAX_PLAYERS).
- `types.ts`: TypeScript interfaces for network messages (e.g., `InputMessage`).
- `movement.ts`: Shared `applyMovement` function for deterministic position updates.

## `src/server/` (Authoritative Game Logic)
- `index.ts`: Colyseus server entry point.
- `schema/game-state.ts`: Colyseus `@colyseus/schema` definitions. Defines the exact state synced to clients (Player position, yaw, pitch, health).
- `rooms/game-room.ts`: The core game loop. Handles `onJoin`, `onLeave`, `onMessage` (inputs), and `setSimulationInterval` (30 Hz tick). Contains server-side hit detection and lag compensation logic.

## `src/client/` (Rendering & Input)
- `main.ts`: The entire client application.
  - **Input**: Keyboard (WASD), Pointer Lock (mouse), Touch (nipplejs joystick + right-side drag + fire button).
  - **Networking**: Connects to Colyseus, sends `InputMessage` at 20 Hz, receives state updates.
  - **Prediction**: Locally predicts player movement using `src/shared/movement.ts` for instant response.
  - **Interpolation**: Smoothly glides remote players between server updates to prevent teleportation.
  - **Rendering**: Three.js scene, camera, and mesh management.

## `public/`
Static assets (future: low-poly models, sounds, textures).

## Key Architectural Patterns
1. **Server Authority**: Client only sends inputs. Server calculates hits, damage, and positions.
2. **Client-Side Prediction**: Local player moves instantly using shared logic; reconciles only if drifted > 2 units.
3. **Interpolation**: Remote players are rendered with a slight delay, smoothly interpolating between server snapshots.
4. **Hitscan**: Server computes a forward vector from player yaw/pitch and checks dot-product distance against other players' positions.
