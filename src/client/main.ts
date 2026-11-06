import { Client } from "colyseus.js";
import nipplejs from "nipplejs";
import * as THREE from "three";
import { SERVER_PORT, OBSTACLES } from "../shared/constants.js";
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

// Add lighting for obstacles
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Add map obstacles
const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8 });
OBSTACLES.forEach(([x, z, w, d]) => {
  const geo = new THREE.BoxGeometry(w, 3, d);
  const mesh = new THREE.Mesh(geo, obstacleMaterial);
  mesh.position.set(x, 1.5, z);
  scene.add(mesh);
});

// Ensure camera is in scene so its child light renders
scene.add(camera);

// Bean-shaped player: capsule (cylinder with sphere caps)
const playerGeometry = new THREE.CapsuleGeometry(0.4, 0.8, 4, 8);

const localMaterial = new THREE.MeshBasicMaterial({
  color: 0x22c55e
});

const remoteMaterial = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  roughness: 0.6,
  metalness: 0.2,
  emissive: 0x330000,
});

interface RemotePlayerData {
  mesh: THREE.Mesh;
  healthBar: THREE.Mesh;
  healthBarBg: THREE.Mesh;
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
let audioCtx: AudioContext | null = null;
let flashTimeout: ReturnType<typeof setTimeout> | null = null;
let muzzleFlashMesh: THREE.Mesh | null = null;

// Build a simple weapon model attached to the camera
const weaponGroup = new THREE.Group();

// Gun body
const gunBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.15, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 })
);
gunBody.position.set(0.25, -0.25, -0.4);
weaponGroup.add(gunBody);

// Gun barrel
const gunBarrel = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.06, 0.4),
  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
);
gunBarrel.position.set(0.25, -0.18, -0.75);
weaponGroup.add(gunBarrel);

// Muzzle flash mesh (initially hidden)
muzzleFlashMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })
);
muzzleFlashMesh.position.set(0.25, -0.18, -0.95);
muzzleFlashMesh.visible = false;
weaponGroup.add(muzzleFlashMesh);

// Attach weapon to camera so it moves with the view
camera.add(weaponGroup);

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


function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playShootSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playHitSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function triggerMuzzleFlash() {
  if (!muzzleFlashMesh) return;
  muzzleFlashMesh.visible = true;
  // Randomize flash size slightly for variety
  const scale = 0.8 + Math.random() * 0.6;
  muzzleFlashMesh.scale.set(scale, scale, scale);
  
  if (flashTimeout) clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => {
    if (muzzleFlashMesh) muzzleFlashMesh.visible = false;
  }, 60);
}

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
        playerGeometry,
        sessionId === localSessionId ? localMaterial : remoteMaterial
      );
      scene.add(mesh);
      
      // Skip health bar for local player (we'll show it in HUD instead)
      if (sessionId === localSessionId) {
        data = {
          mesh,
          healthBar: null as any,
          healthBarBg: null as any,
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
        return;
      }
      
      // Health bar (green fill on dark background)
      const healthBarBg = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.15),
        new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide, depthTest: false })
      );
      healthBarBg.position.set(player.x, 2.2, player.z);
      scene.add(healthBarBg);
      
      const healthBar = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide, depthTest: false })
      );
      healthBar.position.set(player.x, 2.2, player.z + 0.01);
      scene.add(healthBar);
      
      data = {
        mesh,
        healthBar,
        healthBarBg,
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
      
      // Update health bar fill based on current health (skip for local player)
      if (data.healthBar && data.healthBar.material) {
        const health = player.health !== undefined ? player.health : 100;
        const healthPct = Math.max(0, Math.min(100, health)) / 100;
        data.healthBar.scale.x = healthPct;
        data.healthBar.position.x = data.targetX - (1.1 * (1 - healthPct)) / 2;
        
        // Color changes as health drops
        const mat = data.healthBar.material as THREE.MeshBasicMaterial;
        if (healthPct > 0.5) mat.color.setHex(0x22c55e);
        else if (healthPct > 0.25) mat.color.setHex(0xeab308);
        else mat.color.setHex(0xef4444);
      }
    }

    // Update local scoreboard and health HUD if it's the local player
    if (sessionId === localSessionId) {
      const k = player.kills !== undefined ? player.kills : 0;
      const d = player.deaths !== undefined ? player.deaths : 0;
      if (scoreboardEl) scoreboardEl.textContent = `K: ${k} | D: ${d}`;
      
      // Update health HUD
      const health = player.health !== undefined ? player.health : 100;
      const healthHud = document.getElementById("health-hud");
      if (healthHud) {
        healthHud.textContent = `HP: ${Math.max(0, Math.round(health))}`;
        const pct = Math.max(0, Math.min(100, health)) / 100;
        if (pct > 0.5) healthHud.style.color = "#22c55e";
        else if (pct > 0.25) healthHud.style.color = "#eab308";
        else healthHud.style.color = "#ef4444";
      }
    }
  });

  for (const [sessionId, data] of remotePlayers) {
    if (!seen.has(sessionId)) {
      scene.remove(data.mesh);
      if (data.healthBar) scene.remove(data.healthBar);
      if (data.healthBarBg) scene.remove(data.healthBarBg);
      remotePlayers.delete(sessionId);
    }
  }
}

async function connect(roomCode: string): Promise<void> {
  const endpoint = endpointFromLocation();
  setStatus(`Connecting to room ${roomCode}...`);

  try {
    const client = new Client(endpoint);
    
    // filterBy on the server ensures players with the same roomCode are grouped together
    const room = await client.joinOrCreate<GameStateView>("game", { roomCode: roomCode });

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
    camera.position.set(predictedX, 1.5, predictedZ);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    
    // Subtle weapon sway based on movement
    if (weaponGroup) {
      const isMoving = Math.abs(localMoveX) > 0.1 || Math.abs(localMoveZ) > 0.1;
      const swayX = isMoving ? Math.sin(now * 0.015) * 0.02 : 0;
      const swayY = isMoving ? Math.abs(Math.sin(now * 0.015)) * 0.02 : 0;
      weaponGroup.position.set(swayX, swayY, 0);
    }
  }

  // Interpolate remote players
  const interpSpeed = 12.0;
  remotePlayers.forEach((data, sessionId) => {
    if (sessionId === localSessionId) return;

    data.currentX += (data.targetX - data.currentX) * interpSpeed * dt;
    data.currentZ += (data.targetZ - data.currentZ) * interpSpeed * dt;
    data.currentYaw += (data.targetYaw - data.currentYaw) * interpSpeed * dt;
    data.currentPitch += (data.targetPitch - data.currentPitch) * interpSpeed * dt;

    data.mesh.position.set(data.currentX, 0.8, data.currentZ);
    data.mesh.rotation.order = "YXZ";
    data.mesh.rotation.y = data.currentYaw;
    data.mesh.rotation.x = data.currentPitch;
    data.mesh.visible = true;
    
    // Health bar follows the player and faces the camera (skip for local player)
    if (data.healthBarBg && data.healthBar) {
      data.healthBarBg.position.set(data.currentX, 2.2, data.currentZ);
      data.healthBarBg.lookAt(camera.position);
      data.healthBar.position.set(data.currentX, 2.2, data.currentZ);
      data.healthBar.lookAt(camera.position);
    }
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
  const startFire = (e: Event) => { 
    e.preventDefault(); 
    initAudio(); 
    isFiring = true; 
    playShootSound(); 
    triggerMuzzleFlash(); 
  };
  const stopFire = (e: Event) => { e.preventDefault(); isFiring = false; };
  fireBtn.addEventListener("mousedown", startFire);
  fireBtn.addEventListener("mouseup", stopFire);
  fireBtn.addEventListener("touchstart", startFire, { passive: false });
  fireBtn.addEventListener("touchend", stopFire, { passive: false });
}

document.addEventListener("mousedown", (event) => {
  if (event.button === 0 && document.pointerLockElement === canvas) {
    initAudio();
    isFiring = true;
    playShootSound();
    triggerMuzzleFlash();
  }
});
document.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    isFiring = false;
  }
});

const lobbyOverlay = document.getElementById("lobby-overlay");
const roomCodeInput = document.getElementById("room-code-input") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const lobbyError = document.getElementById("lobby-error");

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

joinBtn?.addEventListener("click", async () => {
  let code = roomCodeInput.value.trim().toUpperCase();
  if (!code) {
    code = generateRoomCode();
    roomCodeInput.value = code;
  }
  
  joinBtn.textContent = "Connecting...";
  joinBtn.disabled = true;
  if (lobbyError) lobbyError.textContent = "";

  try {
    await connect(code);
    if (lobbyOverlay) {
      lobbyOverlay.style.display = "none";
    }
    setStatus(`Room: ${code} | Use WASD or arrow keys.`);
  } catch (error) {
    joinBtn.textContent = "JOIN / CREATE";
    joinBtn.disabled = false;
    if (lobbyError) lobbyError.textContent = error instanceof Error ? error.message : "Failed to join room";
  }
});
