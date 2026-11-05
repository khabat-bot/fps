# AGENTS.md — Web Multiplayer FPS (mobile-first)

## Goal
A browser multiplayer FPS for 2–8 friends. **Phones are the primary platform** (touch controls), desktop (keyboard + mouse) is secondary. No anti-cheat, accounts, or matchmaking.

## How to work with the user (IMPORTANT)
The user wants to do as little work as possible.
- You do everything yourself: create files, install dependencies, run commands, fix errors. Do not ask the user to run commands unless it is truly impossible for you to do it.
- Make technical decisions yourself using this file. Only ask the user when a decision is about game design or taste, and ask one short question at a time.
- Never guess. If something is unclear, say so plainly before acting.
- Don't claim something works unless you ran it. Say what you tested and what you couldn't test.
- After each step, tell the user in 2–3 plain sentences: what changed, and the exact thing to test on their phone (a URL and what to do).
- Keep `README.md` up to date with the exact steps to start the game, open it on a phone, and let friends join.

## TODO.md — your memory (MANDATORY)
Create `TODO.md` at the start and keep it current. You will lose context between sessions, so this file is how you know where you are.
- **At the start of every session:** read `AGENTS.md` and `TODO.md` first.
- **After every finished task:** update `TODO.md` immediately.
- Use these sections: `## In progress`, `## Next` (ordered), `## Done` (with short notes), `## Known issues / bugs`, `## Decisions made` (library choices, tuning values, and why).
- Use checkboxes (`- [ ]` / `- [x]`). Only mark done what you actually tested.
- Add any new bug or idea you notice to the list instead of silently fixing unrelated things.

## Fixed stack (do not change without asking)
Chosen because these are the most widely documented, so you make the fewest mistakes.
- Language: **TypeScript** (strict mode) everywhere
- Client rendering: **Three.js**, bundled with **Vite**
- Networking and rooms: **Colyseus** (server and client SDK). Do NOT write a custom netcode layer from scratch.
- Server runtime: **Node.js**
- Touch joystick: **nipplejs**
- Audio: **howler.js**
- Static level collision and raycasts: **three-mesh-bvh** (fast, low overhead) if collision against complex meshes is needed. For simple box-based levels, use plain AABB math in shared code instead and skip the library.
- Dev tooling: `tsx` for running the server, `concurrently` to run client and server together
- Assets: free CC0 low-poly models and sounds (e.g. Kenney assets) in glTF/GLB and OGG/MP3. Don't generate art procedurally unless it's simple primitives or levels built from boxes.

### Library rules
- Use a library for anything hard: networking, state sync, touch joystick, audio, mesh raycasting. Do not hand-roll these.
- Do NOT add a full physics engine (Rapier, Cannon, Ammo). Character movement is a custom capsule/box collider in `src/shared`, which keeps it identical on client and server and cheap on phones.
- Before using any library API, check its installed type definitions or docs. Don't rely on memory for API names or versions.
- Don't add any other dependency without telling the user why. Prefer small libraries. Avoid anything that adds large bundle size or per-frame cost.

## Project layout (single package, one command to run)
- `src/client` — rendering, input, UI, audio
- `src/server` — Colyseus rooms, game logic
- `src/shared` — types, constants, movement and collision code used by both sides
- `public/` — static assets
- `npm run dev` starts both client and server. `npm run build` + `npm start` serves the built client from the Node server (one process, easy to host).
- Dev server must be reachable from a phone on the same network (`--host`), and `README.md` must explain how to open it.

## Architecture rules
1. **Server is authoritative.** Clients send inputs only (move vector, look delta, fire, jump). The server computes positions, hits, damage, deaths, scores.
2. **Client-side prediction** for the local player, with server reconciliation.
3. **Interpolation** for remote players, rendered ~100 ms in the past.
4. **Lag compensation** for hitscan shots: server keeps short position history and rewinds (capped around 200 ms) when checking hits.
5. Movement and collision code lives in `src/shared`, so prediction and the server run identical logic.
6. Fixed server tick rate (start at 30 Hz). All tuning values (speed, damage, fire rate, tick rate) live in `src/shared/constants.ts`.
7. Keep network messages small. Use Colyseus schema/state sync and send inputs, not full state.

## Mobile-first requirements
- Landscape layout. Left virtual joystick (move), right-side drag (look), on-screen fire and jump buttons.
- Block page scroll, pull-to-refresh, pinch zoom, text selection, and context menus during play.
- Desktop: WASD + mouse via Pointer Lock. Touch and keyboard/mouse both produce the same input object.
- Target a stable 60 fps on a mid-range phone.

## Performance rules (phones are weak)
- Low-poly only. Reuse geometries and materials. Merge static level geometry. Use instancing for repeated objects.
- No real-time shadows, no post-processing, no heavy lights by default (use baked/vertex lighting or a couple of simple lights).
- Cap pixel ratio: `Math.min(devicePixelRatio, 2)`.
- No allocations in the render/update loop (reuse vectors, pool bullets/effects).
- Compress textures, keep them small, and prefer texture atlases.
- Don't send or render more than needed. Skip updates for things off-screen.

## Code quality rules
- TypeScript strict. No `any` without a comment explaining why.
- Small modules with one job each. Avoid files over ~300 lines.
- No dead code and no placeholder code presented as finished.
- Make the smallest change that solves the problem. Don't rewrite working code unless asked.
- One feature or one bug per task. Suggest a git commit message after each working step, and make the commit if git is set up.

## Build order (track progress in TODO.md)
1. Scaffold the project, scripts, and README. Two browser tabs connect and see each other as moving cubes.
2. Client-side prediction and interpolation; test with simulated lag.
3. Touch controls and desktop controls on the shared input abstraction.
4. Shooting with server-side hit detection and lag compensation.
5. Health, death, respawn, scoreboard.
6. Rooms with join codes so friends can play together (2–8 players).
7. Real map, low-poly models, sound, game feel (recoil, hit markers, damage feedback).
8. Performance pass on a real phone, then deployment instructions for a small host (Fly.io or Railway).

## Out of scope
Anti-cheat, accounts, public matchmaking, native apps, WebRTC peer-to-peer, full physics engines.

## Definition of done for any step
- Runs with no console errors.
- Works in a phone browser, not just desktop.
- Stable fps and no desync between clients.
- `TODO.md` and `README.md` updated.
