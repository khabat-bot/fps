import { Client } from "colyseus.js";
import nipplejs from "nipplejs";
import * as THREE from "three";
import { SERVER_PORT } from "../shared/constants.js";
import type { InputMessage } from "../shared/types.js";

interface PlayerView {
  x: number;
  y: number;
  z: number;
}

interface GameStateView {
  players: Map<string, PlayerView>;
}

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");

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

const meshes = new Map<string, THREE.Mesh>();

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
    keyboardMoveZ -= 1;
  }

  if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
    keyboardMoveZ += 1;
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

function endpointFromLocation(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:${SERVER_PORT}`;
}

function syncState(state: GameStateView): void {
  const players = state.players;

  players.forEach((player, sessionId) => {
    let mesh = meshes.get(sessionId);

    if (!mesh) {
      mesh = new THREE.Mesh(
        cubeGeometry,
        sessionId === localSessionId ? localMaterial : remoteMaterial
      );

      scene.add(mesh);
      meshes.set(sessionId, mesh);
    }

    mesh.position.set(player.x, 0.5, player.z);
  });

  for (const [sessionId, mesh] of meshes) {
    if (!players.has(sessionId)) {
      scene.remove(mesh);
      meshes.delete(sessionId);
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
      }
    });

    window.setInterval(() => {
      const input: InputMessage = {
        moveX: clampAxis(keyboardMoveX + touchMoveX),
        moveZ: clampAxis(keyboardMoveZ + touchMoveZ)
      };

      void room.send("input", input);
    }, 50);
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

renderer.setAnimationLoop(() => {
  const localMesh = meshes.get(localSessionId);

  if (localMesh) {
    camera.position.set(localMesh.position.x, 8, localMesh.position.z + 8);
    camera.lookAt(localMesh.position);
  }

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
      touchMoveZ = -data.vector.y;
    }
  });

  joystick.on("end", () => {
    touchMoveX = 0;
    touchMoveZ = 0;
  });
}

void connect();
