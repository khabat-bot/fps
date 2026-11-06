import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;

  @type("number") inputX = 0;
  @type("number") inputZ = 0;

  @type("number") yaw = 0;
  @type("number") pitch = 0;

  @type("number") health = 100;
  @type("number") lastFireTime = 0;
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
