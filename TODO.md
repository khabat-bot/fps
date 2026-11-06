# TODO

## In progress

- [ ] Verify interpolation works on phone with simulated lag

## Next

- [ ] Shooting with server-side hit detection and lag compensation
- [ ] Health, death, respawn, scoreboard
- [ ] Rooms with join codes (2–8 players)
- [ ] Real map, low-poly models, sound, game feel
- [ ] Performance pass on real phone, deployment instructions

## Done

- [x] Scaffold project, scripts, README - two tabs connect and see moving cubes
- [x] Client-side prediction - instant local movement response
- [x] Interpolation - smooth remote player movement (no teleporting)
- [x] Touch controls - left joystick (move), right drag (look)
- [x] Desktop controls - WASD + pointer lock mouse look
- [x] Shared input abstraction - touch and keyboard produce same InputMessage
- [x] Camera-relative movement - move in direction you're looking

## Known issues / bugs

- [ ] No shooting yet
- [ ] No health/death/respawn
- [ ] No room codes - everyone joins same room

## Decisions made

- Using Colyseus for networking (not custom netcode)
- Using Three.js for rendering
- TypeScript strict mode everywhere
- Server tick rate: 30 Hz
- Interpolation speed: 12.0 (smooth but responsive)
- Reconciliation threshold: 2 units (only snap if drifted far)
- Camera height: 1.6 units (eye level)
