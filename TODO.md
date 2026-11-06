# TODO

## Done

- [x] Scaffold project, scripts, README
- [x] Client-side prediction - instant local movement response
- [x] Interpolation - smooth remote player movement
- [x] Touch controls - left joystick (move), right drag (look)
- [x] Desktop controls - WASD + pointer lock mouse look
- [x] Shooting with server-side hit detection (ray-vs-sphere, 0.8 radius hitbox)
- [x] Health, death, respawn, scoreboard (K/D tracking, death overlay)
- [x] Private rooms with join codes (Colyseus filterBy)
- [x] Game feel: map obstacles, weapon model, muzzle flash, synthesized sounds
- [x] Bean-shaped players (capsule geometry, no leaning)
- [x] Floating health bars above enemies (green to yellow to red, no z-fighting)
- [x] Health HUD at bottom center for local player
- [x] iOS Safari audio unlock (click/touchstart listeners)
- [x] Server-side obstacle collision (can't walk through walls)

## Next

- [ ] Lag compensation (server-side rewind for fair hits)
- [ ] Deployment instructions (VPS or Colyseus Arena)
- [ ] More weapons (shotgun, sniper)
- [ ] Power-ups (health packs, speed boost)
- [ ] Team deathmatch mode
- [ ] Better map with multiple levels/rooms
- [ ] Low-poly models (replace primitives with actual 3D models)
- [ ] Sound effects library (footsteps, reload, ambient)

## Decisions made

- Using Colyseus for networking (not custom netcode)
- Using Three.js for rendering
- TypeScript strict mode everywhere
- Server tick rate: 30 Hz
- Interpolation speed: 12.0 (smooth but responsive)
- Reconciliation threshold: 2 units (only snap if drifted far)
- Camera height: 1.5 units (eye level)
- Hitbox radius: 0.8 units (generous forgiveness)
- Bean height: 1.6 units (capsule: 0.8 length + 0.4*2 radius)
- Fire rate: 150ms cooldown (3 shots to kill)
- Health bars: floating above enemies, HUD at bottom for local player
- Audio: Web Audio API synthesized sounds (no external MP3s)
- Room isolation: Colyseus filterBy(["roomCode"])
