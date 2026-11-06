# TODO

## In progress

- [ ] Verify Step 1 on desktop and phone: two clients connect and cubes move.

## Next

- [x] Add client-side prediction and server reconciliation.
- [ ] Add interpolation for remote players.
- [ ] Add simulated lag test.
- [x] Add touch joystick using nipplejs.
- [x] Add desktop pointer-lock mouse look.
- [x] Add shared input abstraction for touch and keyboard.

## Done

- [ ] Step 1 code written: scaffold, Colyseus room, Three.js cubes, shared input message.

## Known issues / bugs

- [x] Local player movement uses client-side prediction (instant response).
- [x] Touch controls (move joystick) added.
- [x] Mobile camera controls (touch look) added.

## Decisions made

- Using Colyseus for networking instead of custom netcode.
- Using Three.js for rendering.
- Using TypeScript strict mode.
- Step 1 uses simple cubes before adding FPS models.
- Server is authoritative from the start.
