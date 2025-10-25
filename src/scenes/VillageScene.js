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
    this.otherPlayers = new Map(); // To store sprites of other players
  }

  preload() {
    // Load all possible player avatars
    this.load.image("ArabCharacter_idle", "assets/ArabCharacter_idle.png");
    this.load.image("player2", "assets/player2.png"); // Assuming you have these
    this.load.image("player3", "assets/player3.png"); // Assuming you have these

    // Load all possible house styles
    for (let i = 1; i <= 8; i++) {
      this.load.image(`House${i}`, `assets/House${i}.png`);
    }
  }

  async create() {
    this.auth = getAuthInstance();
    this.db = getDb();
    this.user = this.auth.currentUser;
    if (!this.user) return this.scene.start("MenuScene");

    // --- Define World Properties ---
    const groundLevel = this.cameras.main.height * 0.85; // Lower 15% is ground
    const worldWidth = this.cameras.main.width * 2; // Make the world wider than the screen

    // --- Scaling Calculations ---
    // Player: 30% of screen height
    const playerBaseHeight = 16; // Assuming 16x16 pixel art for player
    const targetPlayerHeight = this.cameras.main.height * 0.2; // Made player a bit bigger
    const playerScale = targetPlayerHeight / playerBaseHeight;

    // House: 50% of screen height
    // Assuming 32x32 pixel art for house. Change if different.
    const houseBaseHeight = 32; // Assuming 32x32 for houses
    const targetHouseHeight = this.cameras.main.height * 0.5;
    const houseScale = targetHouseHeight / houseBaseHeight;

    // Fetch both user and village data
    const userDocRef = doc(this.db, "users", this.user.uid);
    const villageDocRef = doc(this.db, "villages", this.villageId);
    const [userDoc, villageDoc] = await Promise.all([getDoc(userDocRef), getDoc(villageDocRef)]);

    const userData = userDoc.exists() ? userDoc.data() : {};
    const villageData = villageDoc.exists() ? villageDoc.data() : { members: {} };
    const avatar = userData.avatar || "ArabCharacter_idle.png";
    const username = userData.username || "Villager";

    const playerAvatarKey = avatar.split('.')[0]; // "ArabCharacter_idle.png" -> "ArabCharacter_idle"

    // --- Create World Elements ---
    const ground = this.add.rectangle(0, groundLevel, worldWidth, this.cameras.main.height * 0.15, 0x8b4513).setOrigin(0);
    this.physics.add.existing(ground, true); // Make it a static physics body

    // Brown Box (centerpiece)
    const brownRectangle = this.add.rectangle(this.cameras.main.width / 2, groundLevel, 35 * playerScale, 15 * playerScale, 0x8B4513)
      .setOrigin(0.5, 1);

    // --- House Spawning Logic ---
    const members = villageData.members ? Object.entries(villageData.members) : [];
    const sortedMembers = members.sort((a, b) => a[1].joined.toMillis() - b[1].joined.toMillis());
    
    let leftOffset = -100; // Initial offset from center for left-side houses
    let rightOffset = 100; // Initial offset from center for right-side houses

    sortedMembers.forEach(([uid, memberData], index) => {
      const houseKey = (memberData.house || "House1.png").split('.')[0];
      let houseX;
      
      if (index === 0) { // First player (creator)
        houseX = brownRectangle.x - 150;
      } else if (index % 2 !== 0) { // Odd index players (2nd, 4th, etc.) go right
        houseX = brownRectangle.x + 150 + rightOffset;
        rightOffset += 200; // Increase offset for the next right-side house
      } else { // Even index players (3rd, 5th, etc.) go left
        houseX = brownRectangle.x - 150 + leftOffset;
        leftOffset -= 200; // Increase offset for the next left-side house
      }

      this.add.image(houseX, groundLevel, houseKey)
        .setOrigin(0.5, 1)
        .setScale(houseScale);
    });

    // --- Create Player ---
      this.player = this.physics.add.sprite(this.cameras.main.width / 2, groundLevel, playerAvatarKey)
      .setOrigin(0.5, 1) // Anchor to bottom-center
      .setScale(playerScale);
    this.player.setCollideWorldBounds(true);

    // Set the physics body to the original sprite size (e.g., 16x16).
    // Phaser will automatically scale this hitbox along with the visual sprite.
    // If your character has empty space around it in the image, you can use smaller values.
    this.player.body.setSize(16, 16);

    // --- Create Username Text ---
    this.usernameText = this.add.text(this.player.x, this.player.y - 20, username, {
      fontSize: '12px',
      fill: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);

    // --- Physics and Camera ---
    this.physics.add.collider(this.player, ground);
    this.physics.world.setBounds(0, 0, worldWidth, this.cameras.main.height);
    this.cameras.main.setBounds(0, 0, worldWidth, this.cameras.main.height);
    this.cameras.main.startFollow(this.player);

    // --- UI Elements ---
    const villageCode = this.villageId.substring(0, 5).toUpperCase();
    this.add.text(this.cameras.main.width - 10, 10, `Code: ${villageCode}`, {
        fontSize: '16px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: { x: 8, y: 4 }
    })
    .setOrigin(1, 0) // Anchor to top-right
    .setScrollFactor(0); // Make it stick to the camera, not the world

    this.cursors = this.input.keyboard.createCursorKeys();

    this.connectToVillage();
  }

  update() {
    // Guard clause to prevent update from running before create() is complete
    if (!this.cursors || !this.player) return;

    if (this.cursors.left.isDown) this.player.setVelocityX(-160);
    else if (this.cursors.right.isDown) this.player.setVelocityX(160);
    else this.player.setVelocityX(0);

    if (this.cursors.up.isDown && this.player.body.blocked.down)
      this.player.setVelocityY(-200);

    // Apply stronger gravity when falling
    const fallMultiplier = 2.5;
    if (this.player.body.velocity.y > 0) {
      this.player.body.gravity.y = this.physics.world.gravity.y * fallMultiplier;
    } else {
      this.player.body.gravity.y = this.physics.world.gravity.y;
    }

    // Update username position
    this.usernameText.x = this.player.x; // Follow player's X
    this.usernameText.y = this.player.y - this.player.displayHeight - 10; // Position above the scaled player

    // Send position updates
    if (this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0) {
      socket.emit("move", {
        villageId: this.villageId,
        x: this.player.x,
        y: this.player.y,
      });
    }
  }

  connectToVillage() {
    // Join the village via WebSocket
    socket.emit("joinVillage", { villageId: this.villageId, uid: this.user.uid });

    // Listen for updates from the server
    socket.on("playerUpdate", (serverPlayers) => {
      if (!serverPlayers) return;

      const serverPlayerIds = Object.keys(serverPlayers);

      // Update or create other players
      for (const id in serverPlayers) {
        const serverPlayer = serverPlayers[id];
        if (serverPlayer.uid === this.user.uid) continue; // Skip self

        if (this.otherPlayers.has(serverPlayer.uid)) {
          // Player exists, update position
          const existingPlayer = this.otherPlayers.get(serverPlayer.uid);
          existingPlayer.sprite.setPosition(serverPlayer.x, serverPlayer.y);
          existingPlayer.usernameText.setPosition(serverPlayer.x, serverPlayer.y - existingPlayer.sprite.displayHeight - 10);
        } else {
          // New player, create them
          this.createOtherPlayer(serverPlayer);
        }
      }

      // Remove players who have left
      this.otherPlayers.forEach((player, uid) => {
        const stillConnected = Object.values(serverPlayers).some(p => p.uid === uid);
        if (!stillConnected) {
          player.sprite.destroy();
          player.usernameText.destroy();
          this.otherPlayers.delete(uid);
        }
      });
    });
  }

  async createOtherPlayer(playerData) {
    // Fetch the new player's user data from Firestore to get their avatar and username
    const userDoc = await getDoc(doc(this.db, "users", playerData.uid));
    if (!userDoc.exists()) return;

    const otherUserData = userDoc.data();
    const avatarKey = (otherUserData.avatar || "ArabCharacter_idle.png").split('.')[0];
    const username = otherUserData.username || "Villager";

    const sprite = this.add.sprite(playerData.x, playerData.y, avatarKey).setScale(this.player.scale);
    sprite.setOrigin(0.5, 1);

    const usernameText = this.add.text(playerData.x, playerData.y - sprite.displayHeight - 10, username, {
        fontSize: '12px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5);

    this.otherPlayers.set(playerData.uid, { sprite, usernameText });
  }
}
