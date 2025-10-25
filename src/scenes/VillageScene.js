import * as Phaser from "phaser";
import { getDb } from "../firebase-config.js";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { socket } from "../websocket.js";

export default class VillageScene extends Phaser.Scene {
  constructor() {
    super("VillageScene");
  }

  init(data) {
    this.villageId = data.villageId;
  }

  preload() {
    this.load.image("player", "assets/player.png");
    this.load.image("house", "assets/house.png");
    this.load.image("fountain", "assets/fountain.png");
  }

  create() {
    this.add.image(480, 400, "fountain");
    this.player = this.physics.add.sprite(100, 400, "player");

    this.cursors = this.input.keyboard.createCursorKeys();

    socket.emit("joinVillage", { villageId: this.villageId });
    socket.on("playerUpdate", (players) => {
      // Update other players’ positions
    });
  }

  update() {
    if (this.cursors.left.isDown) this.player.setVelocityX(-160);
    else if (this.cursors.right.isDown) this.player.setVelocityX(160);
    else this.player.setVelocityX(0);

    if (this.cursors.up.isDown && this.player.body.touching.down)
      this.player.setVelocityY(-400);

    // Send position
    socket.emit("move", {
      villageId: this.villageId,
      x: this.player.x,
      y: this.player.y,
    });
  }
}
