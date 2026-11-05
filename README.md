# Web Multiplayer FPS — Step 1

This is the first playable scaffold.

Current state:
- Vite client
- Three.js renderer
- Colyseus multiplayer server
- Two or more browser tabs can connect
- Each client appears as a cube
- Desktop movement: WASD or arrow keys
- Mobile movement: Left-side virtual joystick
- Touch controls are not implemented yet

## Run

    npm install
    npm run dev

## Open on desktop

    http://localhost:5173

## Open on phone

Your phone must be on the same Wi-Fi network as the computer running the dev server.

Find your computer IP:

    hostname -I

Then open:

    http://YOUR_COMPUTER_IP:5173

Example:

    http://192.168.1.20:5173

## Test

1. Open the page in two browser tabs.
2. Press WASD or arrow keys in one tab.
3. The other tab should see the cube move.
4. Open the page on your phone.
5. Move a cube on desktop.
6. The phone should see the movement.
7. On your phone, use the left-side joystick to move the cube.

## Known limitations

- Movement is server-authoritative without prediction.
- Local movement may feel slightly delayed.
- Touch controls (move & look) are implemented.
- First-person camera with mouse look (desktop) and touch look (mobile).
- No shooting yet.
