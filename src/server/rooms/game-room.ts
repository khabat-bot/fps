import { createRequire } from "node:module";
import type { Client } from "colyseus";
import { GameState, Player } from "../schema/game-state.js";
import { TICK_RATE, MOVE_SPEED, MAX_PLAYERS } from "../../shared/constants.js";
import { applyMovement } from "../../shared/movement.js";
import type { InputMessage } from "../../shared/types.js";

const require = createRequire(import.meta.url);
const Colyseus = require("colyseus");
const { Room } = Colyseus;

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export class GameRoom extends Room<GameState> {
  onCreate(options: any) {
    this.maxClients = MAX_PLAYERS;
    this.setState(new GameState());

    this.setSimulationInterval((deltaTime: number) => {
      this.updateMovement(deltaTime);
    }, 1000 / TICK_RATE);

    this.onMessage("input", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const input = message as InputMessage;

      player.inputX = clampAxis(typeof input.moveX === "number" ? input.moveX : 0);
      player.inputZ = clampAxis(typeof input.moveZ === "number" ? input.moveZ : 0);

      if (typeof input.yaw === "number") player.yaw = input.yaw;
      if (typeof input.pitch === "number") player.pitch = input.pitch;

      if (input.fire) {
        const now = Date.now();
        if (now - player.lastFireTime > 150) {
          player.lastFireTime = now;
          const forwardX = -Math.sin(player.yaw) * Math.cos(player.pitch);
          const forwardZ = -Math.cos(player.yaw) * Math.cos(player.pitch);
          
          this.state.players.forEach((target: Player, targetId: string) => {
            if (targetId === client.sessionId) return;
            const dx = target.x - player.x;
            const dz = target.z - player.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 20) {
              const dirX = dx / dist;
              const dirZ = dz / dist;
              const dot = forwardX * dirX + forwardZ * dirZ;
              if (dot > 0.95) {
                target.health -= 34;
                if (target.health <= 0) {
                  target.deaths += 1;
                  player.kills += 1;
                  target.health = 100;
                  target.x = Math.random() * 6 - 3;
                  target.z = Math.random() * 6 - 3;
                }
              }
            }
          });
        }
      }
    });
  }

  onJoin(client: Client) {
    const player = new Player();

    player.x = Math.random() * 6 - 3;
    player.y = 0;
    player.z = Math.random() * 6 - 3;

    player.inputX = 0;
    player.inputZ = 0;

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  updateMovement(deltaTime: number) {
    const dt = deltaTime / 1000;

    this.state.players.forEach((player: Player) => {
      const next = applyMovement(player.x, player.z, player.inputX, player.inputZ, dt);
      player.x = next.x;
      player.z = next.z;
    });
  }
}
