import * as Phaser from "phaser";
import { getDb, getAuthInstance } from "../firebase-config.js";
import { doc, getDoc } from "firebase/firestore";
import { socket } from "../websocket.js";

export default class VillageScene extends Phaser.Scene {
  constructor() {
    super("VillageScene");
  }

  init(data) {
    this.villageId = data.villageId;
  }

  preload() {
    // Load all possible player avatars
    this.load.image("player1", "assets/player1.png");
    this.load.image("player2", "assets/player2.png");
    this.load.image("player3", "assets/player3.png");

    this.load.image("house", "assets/house.png");
    this.load.image("fountain", "assets/fountain.png");
  }

  async create() {
    this.auth = getAuthInstance();
    this.db = getDb();
    this.user = this.auth.currentUser;

    const userDoc = await getDoc(doc(this.db, "users", this.user.uid));
    const avatar = userDoc.exists() ? userDoc.data().avatar || "player1" : "player1";
    const playerAvatarKey = avatar.split('.')[0]; // "player1.png" -> "player1"

    this.add.image(480, 400, "fountain");
    this.player = this.physics.add.sprite(100, 400, playerAvatarKey);

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
