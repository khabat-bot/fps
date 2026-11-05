import { createRequire } from "node:module";
import type { Client } from "colyseus";
import { GameState, Player } from "../schema/game-state.js";
import { TICK_RATE, MOVE_SPEED, MAX_PLAYERS } from "../../shared/constants.js";
import type { InputMessage } from "../../shared/types.js";

const require = createRequire(import.meta.url);
const Colyseus = require("colyseus");
const { Room } = Colyseus;

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export class GameRoom extends Room<GameState> {
  onCreate() {
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
      player.x += player.inputX * MOVE_SPEED * dt;
      player.z += player.inputZ * MOVE_SPEED * dt;
    });
  }
}
