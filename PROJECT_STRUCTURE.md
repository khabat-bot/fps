# Project Structure

This document provides a high-level overview of the codebase for AI assistants and new developers.

## Root Directory

- package.json / tsconfig.json / vite.config.ts: Project configuration
- index.html: Entry point with UI overlays (crosshair, fire button, health HUD, scoreboard, death overlay, lobby)
- TODO.md: Task tracker with current progress
- AGENTS.md: Master rulebook for AI behavior
- PROJECT_STRUCTURE.md: This file
- README.md: User-facing documentation

## src/shared/ (Authoritative Logic)

Code that runs identically on both client and server.

- constants.ts: Tuning values (TICK_RATE, MOVE_SPEED, MAX_PLAYERS, OBSTACLES array)
- types.ts: TypeScript interfaces for network messages (InputMessage with moveX, moveZ, yaw, pitch, fire)
- movement.ts: Shared applyMovement and checkCollision functions for deterministic position updates with obstacle collision

## src/server/ (Authoritative Game Logic)

- index.ts: Colyseus server entry point. Defines "game" room with filterBy(["roomCode"]) for private room isolation.
- schema/game-state.ts: Colyseus schema definitions:
  - Player: x, y, z, inputX, inputZ, yaw, pitch, health, lastFireTime, kills, deaths
  - GameState: Map of Player instances
- rooms/game-room.ts: Core game loop:
  - onJoin: Spawn player at random position
  - onLeave: Remove player from state
  - onMessage("input"): Update player input, perform ray-vs-sphere hit detection (0.8 radius hitbox, y=0.8 center), handle kills/deaths/respawns
  - setSimulationInterval (30 Hz tick): Update movement with obstacle collision

## src/client/ (Rendering & Input)

- main.ts: The entire client application:
  - Input: Keyboard (WASD), Pointer Lock (mouse), Touch (nipplejs joystick + right-side drag + fire button)
  - Networking: Connects to Colyseus, sends InputMessage at 20 Hz, receives state updates
  - Prediction: Locally predicts player movement using src/shared/movement.ts for instant response
  - Interpolation: Smoothly glides remote players between server updates (12.0 lerp speed)
  - Rendering: Three.js scene with:
    - Bean-shaped players (CapsuleGeometry, y=0.8 position)
    - Low-poly weapon model attached to camera (body + barrel + muzzle flash mesh)
    - Map obstacles (BoxGeometry with MeshStandardMaterial)
    - Ambient + directional lighting
    - Floating health bars above enemies (PlaneGeometry with depthTest: false)
  - Audio: Web Audio API synthesized sounds (shoot, hit) with iOS Safari unlock
  - UI: Health HUD (bottom center), scoreboard (top-right), death overlay, crosshair

## Key Architectural Patterns

1. Server Authority: Client only sends inputs. Server calculates hits, damage, and positions.
2. Client-Side Prediction: Local player moves instantly using shared logic; reconciles only if drifted > 2 units.
3. Interpolation: Remote players are rendered with a slight delay, smoothly interpolating between server snapshots.
4. Hitscan: Server computes a 3D forward vector from player yaw/pitch and checks ray-vs-sphere distance against other players' positions (0.8 radius, y=0.8 center).
5. Room Isolation: Colyseus filterBy(["roomCode"]) ensures players with the same room code are grouped together.
6. Obstacle Collision: Server checks player position against shared OBSTACLES array before allowing movement.

## Current Features

- Cross-platform controls (desktop + mobile)
- Server-authoritative shooting with ray-vs-sphere hit detection
- Private rooms with join codes
- Client-side prediction + interpolation
- Bean-shaped players with health bars
- Low-poly weapon model with muzzle flash
- Synthesized sound effects (Web Audio API)
- Map with obstacles and collision
- Scoreboard (K/D tracking)
- Health HUD + death overlay
- iOS Safari support
