import { createRequire } from "node:module";
import { GameRoom } from "./rooms/game-room.js";
import { SERVER_PORT } from "../shared/constants.js";

const require = createRequire(import.meta.url);
const Colyseus = require("colyseus");
const { Server } = Colyseus;

async function main() {
  const server = new Server();

  server.define("game", GameRoom);

  await server.listen(SERVER_PORT);

  console.log(`[server] Colyseus listening on port ${SERVER_PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
