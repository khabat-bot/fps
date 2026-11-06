import { Client } from "colyseus.js";
import nipplejs from "nipplejs";
import * as THREE from "three";
import { SERVER_PORT } from "../shared/constants.js";
import type { InputMessage } from "../shared/types.js";
import { applyMovement } from "../shared/movement.js";

interface PlayerView {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  kills: number;
  deaths: number;
}

interface GameStateView {
  players: Map<string, PlayerView>;
}

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const scoreboardEl = document.getElementById("scoreboard");
const deathOverlayEl = document.getElementById("death-overlay");
let isDead = false;

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas element missing");
}

if (!(statusEl instanceof HTMLElement)) {
  throw new Error("Status element missing");
}

function setStatus(text: string): void {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111827);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

camera.position.set(0, 8, 8);
camera.lookAt(0, 0, 0);

scene.add(new THREE.GridHelper(40, 40, 0x6b7280, 0x374151));

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

const localMaterial = new THREE.MeshBasicMaterial({
  color: 0x22c55e
});

const remoteMaterial = new THREE.MeshBasicMaterial({
  color: 0xef4444
});

interface RemotePlayerData {
  mesh: THREE.Mesh;
  targetX: number;
  targetZ: number;
  currentX: number;
  currentZ: number;
  targetYaw: number;
  targetPitch: number;
  currentYaw: number;
  currentPitch: number;
}

const remotePlayers = new Map<string, RemotePlayerData>();

let localSessionId = "";

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const pressedKeys = new Set<string>();

let keyboardMoveX = 0;
let keyboardMoveZ = 0;
let touchMoveX = 0;
let touchMoveZ = 0;

let predictedX = 0;
let predictedZ = 0;
let lastTime = performance.now();
let lastHealth = 100;

let yaw = 0;
let pitch = 0;
let isFiring = false;
const mouseSensitivity = 0.002;
const touchSensitivity = 0.005;

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function updateMoveVector(): void {
  keyboardMoveX = 0;
  keyboardMoveZ = 0;

  if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) {
    keyboardMoveX -= 1;
  }

  if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) {
    keyboardMoveX += 1;
  }

  if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) {
    keyboardMoveZ += 1;
  }

  if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
    keyboardMoveZ -= 1;
  }
}

window.addEventListener("keydown", (event) => {
  if (!event.repeat) {
    pressedKeys.add(event.code);
  }
  updateMoveVector();
});

window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
  updateMoveVector();
});

window.addEventListener("blur", () => {
  pressedKeys.clear();
  updateMoveVector();
});

// Desktop pointer lock
document.addEventListener("click", () => {
  if (!document.pointerLockElement) {
    canvas.requestPointerLock();
  }
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === canvas) {
    yaw -= event.movementX * mouseSensitivity;
    pitch -= event.movementY * mouseSensitivity;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
  }
});

// Mobile touch look
const lookZone = document.getElementById("look-zone");
if (lookZone) {
  let lookTouchId: number | null = null;
  let lastTouchX = 0;
  let lastTouchY = 0;

  lookZone.addEventListener("touchstart", (event) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (lookTouchId === null) {
        lookTouchId = touch.identifier;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        break;
      }
    }
  });

  lookZone.addEventListener("touchmove", (event) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch.identifier === lookTouchId) {
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;
        yaw -= dx * touchSensitivity;
        pitch -= dy * touchSensitivity;
        pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        event.preventDefault();
        break;
      }
    }
  }, { passive: false });

  const clearLookTouch = (event: TouchEvent) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === lookTouchId) {
        lookTouchId = null;
        break;
      }
    }
  };
  lookZone.addEventListener("touchend", clearLookTouch);
  lookZone.addEventListener("touchcancel", clearLookTouch);
}

function endpointFromLocation(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:${SERVER_PORT}`;
}

function syncState(state: GameStateView): void {
  const players = state.players;
  const seen = new Set<string>();

  players.forEach((player, sessionId) => {
    seen.add(sessionId);
    let data = remotePlayers.get(sessionId);

    if (!data) {
      const mesh = new THREE.Mesh(
        cubeGeometry,
        sessionId === localSessionId ? localMaterial : remoteMaterial
      );
      scene.add(mesh);
      data = {
        mesh,
        targetX: player.x,
        targetZ: player.z,
        currentX: player.x,
        currentZ: player.z,
        targetYaw: player.yaw || 0,
        targetPitch: player.pitch || 0,
        currentYaw: player.yaw || 0,
        currentPitch: player.pitch || 0,
      };
      remotePlayers.set(sessionId, data);
    } else {
      data.targetX = player.x;
      data.targetZ = player.z;
      data.targetYaw = player.yaw || 0;
      data.targetPitch = player.pitch || 0;
    }

    // Update local scoreboard if it's the local player
    if (sessionId === localSessionId && scoreboardEl) {
      const k = player.kills !== undefined ? player.kills : 0;
      const d = player.deaths !== undefined ? player.deaths : 0;
      scoreboardEl.textContent = `K: ${k} | D: ${d}`;
    }
  });

  for (const [sessionId, data] of remotePlayers) {
    if (!seen.has(sessionId)) {
      scene.remove(data.mesh);
      remotePlayers.delete(sessionId);
    }
  }
}

async function connect(): Promise<void> {
  const endpoint = endpointFromLocation();

  setStatus(`Connecting to ${endpoint}...`);

  try {
    const client = new Client(endpoint);
    const room = await client.joinOrCreate<GameStateView>("game");

    localSessionId = room.sessionId;

    setStatus(`Connected as ${localSessionId}. Use WASD or arrow keys.`);

    room.onStateChange((state) => {
      if (state) {
        syncState(state);
        // Reconciliation: only correct large drift to prevent jitter.
        // The server state is slightly in the past due to network transit,
        // so snapping to it every tick teleports the camera backwards.
        const localPlayer = state.players.get(localSessionId);
        if (localPlayer) {
          if (localPlayer.health < lastHealth) {
            const flash = document.getElementById("hit-flash");
            if (flash) {
              flash.style.opacity = "1";
              setTimeout(() => { flash.style.opacity = "0"; }, 100);
            }
          }
          
          if (localPlayer.health <= 0 && !isDead) {
            isDead = true;
            if (deathOverlayEl) deathOverlayEl.classList.add("active");
          } else if (localPlayer.health > 0 && isDead) {
            isDead = false;
            if (deathOverlayEl) deathOverlayEl.classList.remove("active");
          }
          
          lastHealth = localPlayer.health;

          const dx = localPlayer.x - predictedX;
          const dz = localPlayer.z - predictedZ;
          if (dx * dx + dz * dz > 4.0) { // Only snap if drifted > 2 units
            predictedX = localPlayer.x;
            predictedZ = localPlayer.z;
          }
        }
      }
    });

    window.setInterval(() => {
      const localMoveX = clampAxis(keyboardMoveX + touchMoveX);
      const localMoveZ = clampAxis(keyboardMoveZ + touchMoveZ);

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);

      const input: InputMessage = {
        moveX: localMoveX * cosYaw - localMoveZ * sinYaw,
        moveZ: -localMoveX * sinYaw - localMoveZ * cosYaw,
        yaw,
        pitch,
        fire: isFiring
      };

      void room.send("input", input);
    }, 50);
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap dt to prevent huge jumps
  lastTime = now;

  // Predict local movement
  const localMoveX = clampAxis(keyboardMoveX + touchMoveX);
  const localMoveZ = clampAxis(keyboardMoveZ + touchMoveZ);
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const worldMoveX = localMoveX * cosYaw - localMoveZ * sinYaw;
  const worldMoveZ = -localMoveX * sinYaw - localMoveZ * cosYaw;

  const next = applyMovement(predictedX, predictedZ, worldMoveX, worldMoveZ, dt);
  predictedX = next.x;
  predictedZ = next.z;

  const localData = remotePlayers.get(localSessionId);
  if (localData) {
    localData.mesh.visible = false;
    camera.position.set(predictedX, 1.6, predictedZ);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  // Interpolate remote players
  const interpSpeed = 12.0;
  remotePlayers.forEach((data, sessionId) => {
    if (sessionId === localSessionId) return;

    data.currentX += (data.targetX - data.currentX) * interpSpeed * dt;
    data.currentZ += (data.targetZ - data.currentZ) * interpSpeed * dt;
    data.currentYaw += (data.targetYaw - data.currentYaw) * interpSpeed * dt;
    data.currentPitch += (data.targetPitch - data.currentPitch) * interpSpeed * dt;

    data.mesh.position.set(data.currentX, 0.5, data.currentZ);
    data.mesh.rotation.order = "YXZ";
    data.mesh.rotation.y = data.currentYaw;
    data.mesh.rotation.x = data.currentPitch;
    data.mesh.visible = true;
  });

  renderer.render(scene, camera);
});

const joystickZone = document.getElementById("joystick-zone");
if (joystickZone) {
  const joystick = nipplejs.create({
    zone: joystickZone,
    mode: "static",
    position: { left: "100px", bottom: "100px" },
    color: "rgba(255, 255, 255, 0.5)",
    size: 120
  });

  joystick.on("move", (evt, data) => {
    if (data.vector) {
      touchMoveX = data.vector.x;
      touchMoveZ = data.vector.y;
    }
  });

  joystick.on("end", () => {
    touchMoveX = 0;
    touchMoveZ = 0;
  });
}

const fireBtn = document.getElementById("fire-btn");
if (fireBtn) {
  const startFire = (e: Event) => { e.preventDefault(); isFiring = true; };
  const stopFire = (e: Event) => { e.preventDefault(); isFiring = false; };
  fireBtn.addEventListener("mousedown", startFire);
  fireBtn.addEventListener("mouseup", stopFire);
  fireBtn.addEventListener("touchstart", startFire, { passive: false });
  fireBtn.addEventListener("touchend", stopFire, { passive: false });
}

document.addEventListener("mousedown", (event) => {
  if (event.button === 0 && document.pointerLockElement === canvas) {
    isFiring = true;
  }
});
document.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    isFiring = false;
  }
});

void connect();
