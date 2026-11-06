# Web Multiplayer FPS

A real-time multiplayer first-person shooter built with Colyseus, Three.js, and TypeScript. Runs in any modern browser on desktop and mobile (iOS Safari supported).

## Features

- Cross-platform controls (desktop WASD + mouse, mobile joystick + touch)
- Server-authoritative shooting with ray-vs-sphere hit detection
- Private rooms with join codes (Colyseus filterBy)
- Client-side prediction + interpolation for smooth movement
- Bean-shaped players with floating health bars
- Low-poly weapon model with muzzle flash
- Synthesized sound effects (Web Audio API)
- Map with obstacles and server-side collision
- Scoreboard (K/D tracking) and health HUD
- iOS Safari audio unlock support

## Quick Start

npm install
npm run dev

Open http://localhost:5173 in two browser tabs or your phone.

## How to Play

1. Enter a room code (or leave blank for random)
2. Click "JOIN / CREATE"
3. Share the code with friends
4. Shoot the beans!

### Controls

Desktop: WASD + mouse look + left click to shoot
Mobile: Left joystick + right drag + FIRE button

## Tech Stack

- Server: Colyseus (Node.js)
- Client: Three.js + Vite
- Language: TypeScript (strict mode)
- Audio: Web Audio API (synthesized)

See PROJECT_STRUCTURE.md for detailed codebase breakdown.
