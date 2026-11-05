# TODO

## In progress

- [ ] Verify Step 1 on desktop and phone: two clients connect and cubes move.

## Next

- [ ] Add client-side prediction and server reconciliation.
- [ ] Add interpolation for remote players.
- [ ] Add simulated lag test.
- [x] Add touch joystick using nipplejs.
- [ ] Add desktop pointer-lock mouse look.
- [ ] Add shared input abstraction for touch and keyboard.

## Done

- [ ] Step 1 code written: scaffold, Colyseus room, Three.js cubes, shared input message.

## Known issues / bugs

- [ ] Local player movement has no prediction yet, so it may feel delayed.
- [x] Touch controls (move joystick) added.
- [ ] No mobile camera controls yet.

## Decisions made

- Using Colyseus for networking instead of custom netcode.
- Using Three.js for rendering.
- Using TypeScript strict mode.
- Step 1 uses simple cubes before adding FPS models.
- Server is authoritative from the start.
