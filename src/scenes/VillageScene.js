import * as Phaser from "phaser";
import { getDb, getAuthInstance, getRealtimeDb } from "../firebase-config.js";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { ref, set, onValue, onDisconnect, remove } from "firebase/database";

export default class VillageScene extends Phaser.Scene {
  constructor() {
    super("VillageScene");
  }

  init(data) {
    this.villageId = data.villageId;
    this.otherPlayers = new Map(); // To store sprites of other players
    this.playerRef = null; // Reference to this player in Realtime Database
    this.houses = new Map(); // To store spawned house sprites
    this.villageUnsubscribe = null; // To clean up the Firestore listener
    this.mainPlayerSprite = null; // Reference to the main player's sprite
    this.ground = null; // Reference to the ground physics object
    this.lastY = 0; // For tracking Y position changes
    this.loadingPlayers = new Set();
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
    this.rtdb = getRealtimeDb();
    this.user = this.auth.currentUser;
    if (!this.user) return this.scene.start("MenuScene");

    // Hide the main UI container
    document.getElementById("ui").style.display = "none";

    // --- Define World Properties ---
    const groundLevel = this.cameras.main.height * 0.85; // Lower 15% is ground
    const spawnHeight = groundLevel - 50; // Spawn players slightly above ground
    const worldWidth = this.cameras.main.width * 2; // Make the world wider than the screen

    // --- Scaling Calculations ---
    // Player: 30% of screen height
    const playerBaseHeight = 16; // Assuming 16x16 pixel art for player
    const targetPlayerHeight = this.cameras.main.height * 0.2; // Made player a bit bigger
    const playerScale = targetPlayerHeight / playerBaseHeight;

    // House: 50% of screen height
    // Assuming 32x32 pixel art for house. Change if different.
    const houseBaseHeight = 16; // Assuming 32x32 for houses
    const targetHouseHeight = this.cameras.main.height * 0.2;
    const houseScale = targetHouseHeight / houseBaseHeight;

    const userDoc = await getDoc(doc(this.db, "users", this.user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const avatar = userData.avatar || "ArabCharacter_idle.png";
    const username = userData.username || "Villager";

    const playerAvatarKey = avatar.split('.')[0]; // "ArabCharacter_idle.png" -> "ArabCharacter_idle"

    // --- Create World Elements ---
    this.ground = this.add.rectangle(0, groundLevel, worldWidth, this.cameras.main.height * 0.15, 0x8b4513).setOrigin(0);
    this.physics.add.existing(this.ground, true); // Make it a static physics body

    // Brown Box (centerpiece)
    this.brownRectangle = this.add.rectangle(worldWidth / 2, groundLevel, 35 * playerScale, 15 * playerScale, 0x8B4513)
      .setOrigin(0.5, 1) // bottom-center
      .setDepth(1);

    // --- Create Player ---
      this.player = this.physics.add.sprite(this.brownRectangle.x, this.brownRectangle.y - 50, playerAvatarKey)
      .setOrigin(0.5, 1) // Anchor to bottom-center
      .setScale(playerScale)
      .setDepth(2); // Set player depth to be higher than houses
    this.player.setCollideWorldBounds(true);
    this.mainPlayerSprite = this.player; // Store a reference to the main player

    // Set the physics body to the original sprite size (e.g., 16x16).
    // Phaser will automatically scale this hitbox along with the visual sprite.
    // If your character has empty space around it in the image, you can use smaller values.
    this.player.body.setSize(16, 16);

    // --- Create Username Text ---
    this.usernameText = this.add.text(this.player.x, this.player.y - this.player.displayHeight - 10, username, {
      fontSize: '12px',
      fill: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(2); // Match player depth

    // --- Physics and Camera ---
    this.physics.add.collider(this.player, this.ground);
    this.physics.world.setBounds(0, 0, worldWidth, this.cameras.main.height);
    this.cameras.main.setBounds(0, 0, worldWidth, this.cameras.main.height);

    // Immediately sync initial position
    this.physics.world.once('worldstep', () => {
      if (this.playerRef) {
        set(this.playerRef, {
          x: this.player.x,
          yNorm: this.player.y / this.cameras.main.height,
          vx: 0
        });
      }
    });
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
    this.listenForVillageUpdates();
  }

  updatePlayerPosition() {
    if (this.playerRef) {
      set(this.playerRef, {
        x: this.player.x,
        yNorm: this.player.y / this.cameras.main.height, // normalized Y (0..1)
        vx: this.player.body.velocity.x, // Also send velocity
      });
    }
  }

  update() {
    // Guard clause to prevent update from running before create() is complete
    if (!this.cursors || !this.player) return;

    let isMoving = false;

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160);
      isMoving = true;
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160);
      isMoving = true;
    } else {
      this.player.setVelocityX(0);
    }

    if (this.cursors.up.isDown && this.player.body.blocked.down) {
      this.player.setVelocityY(-200);
      isMoving = true;
    }

    // Update username position
    this.usernameText.x = this.player.x; // Follow player's X
    this.usernameText.y = this.player.y - this.player.displayHeight - 10; // Position above the scaled player

    const previousY = this.lastY || this.player.y;
    const movedY = Math.abs(this.player.y - previousY) > 2; // only send if y changed meaningfully
    this.lastY = this.player.y;

    // Send updates only if moving or Y changed (e.g., jumping)
    if (isMoving || movedY) {
      this.updatePlayerPosition();
    }
  }

  connectToVillage() {
    const villagePlayersRef = ref(this.rtdb, `villages/${this.villageId}/players`);
    this.playerRef = ref(this.rtdb, `villages/${this.villageId}/players/${this.user.uid}`);

    // Wait for the first physics step to ensure the player is properly on the ground
    // before setting the initial position in the database.
    // Set up onDisconnect to remove the player when they close the tab
    onDisconnect(this.playerRef).remove();

    // Listen for updates to all players in the village
    onValue(villagePlayersRef, (snapshot) => {
      const serverPlayers = snapshot.val();
      if (!serverPlayers) return;

      const serverPlayerIds = Object.keys(serverPlayers);
      const allPlayers = Object.entries(serverPlayers);

      // Update or create other players
      allPlayers.forEach(([uid, playerData]) => {
        if (uid === this.user.uid) return; // Skip self

        if (this.otherPlayers.has(uid)) {
          // Player exists, update position
          const existingPlayer = this.otherPlayers.get(uid);

          // De-normalize Y for this client
          const targetX = playerData.x;
          const targetY = (typeof playerData.yNorm === 'number')
            ? playerData.yNorm * this.cameras.main.height
            : playerData.y || existingPlayer.sprite.y;

          // Smoothly move the player
          this.tweens.add({
            targets: existingPlayer.sprite,
            x: targetX,
            y: targetY,
            duration: 60, // faster interpolation for jumps
            ease: 'Linear'
          });

          existingPlayer.usernameText.setPosition(targetX, targetY - existingPlayer.sprite.displayHeight - 10);
        } else {
          // New player, create them
          this.createOtherPlayer(uid, playerData);
        }
      });

      // Remove players who have left
      this.otherPlayers.forEach((player, uid) => {
        const stillConnected = serverPlayerIds.includes(uid);
        if (!stillConnected) {
          player.sprite.destroy();
          player.usernameText.destroy();
          this.otherPlayers.delete(uid);
        }
      });
    });

    // Clean up the listener when the scene shuts down
    this.events.on('shutdown', () => {
      // Remove the player from the Realtime Database when they leave the scene
      if (this.playerRef) {
        remove(this.playerRef);
      }
      // Unsubscribe from Firestore listener
      if (this.villageUnsubscribe) {
        this.villageUnsubscribe();
      }
    });
  }

  listenForVillageUpdates() {
    const villageDocRef = doc(this.db, "villages", this.villageId);
    this.villageUnsubscribe = onSnapshot(villageDocRef, (doc) => {
      if (!doc.exists()) return;

      const villageData = doc.data();
      const members = villageData.members ? Object.entries(villageData.members) : [];
      const sortedMembers = members.sort((a, b) => {
        return a[1].joined.toDate().getTime() - b[1].joined.toDate().getTime();
      });

      this.spawnHouses(sortedMembers);
    });
  }

  spawnHouses(sortedMembers) {
    const groundLevel = 0; // brown box is at 0,0 for Y
    const houseBaseHeight = 16;
    const targetHouseHeight = this.cameras.main.height * 0.2;
    const houseScale = targetHouseHeight / houseBaseHeight;

    const gap = 500; // fixed gap

    let leftIndex = 0;
    let rightIndex = 0;

    sortedMembers.forEach(([uid, memberData], index) => {
      if (!memberData.house || this.houses.has(uid)) return;

      const houseKey = memberData.house.split('.')[0];
      let houseX;

      if (index % 2 === 0) {
        houseX = -gap * (leftIndex + 1);
        leftIndex++;
      } else {
        houseX = gap * (rightIndex + 1);
        rightIndex++;
      }

      const houseSprite = this.add.image(this.brownRectangle.x + houseX, this.brownRectangle.y + groundLevel, houseKey)
        .setOrigin(0.5, 1)
        .setScale(houseScale)
        .setDepth(1);

      this.houses.set(uid, houseSprite);
    });
  }

  async createOtherPlayer(uid, playerData) {
    if (this.otherPlayers.has(uid) || this.loadingPlayers.has(uid)) return;
    this.loadingPlayers.add(uid);

    // Fetch the new player's user data from Firestore to get their avatar and username
    const userDoc = await getDoc(doc(this.db, "users", uid));
    if (!userDoc.exists()) {
      this.loadingPlayers.delete(uid);
      return;
    }

    const otherUserData = userDoc.data();
    const avatarKey = (otherUserData.avatar || "ArabCharacter_idle.png").split('.')[0];
    const username = otherUserData.username || "Villager";

    // De-normalize incoming Y for this client
    const spawnX = playerData.x || this.cameras.main.width / 2;
    const spawnY = (typeof playerData.yNorm === 'number')
      ? playerData.yNorm * this.cameras.main.height
      : (playerData.y || this.cameras.main.height * 0.85 - 50);

    const sprite = this.physics.add.sprite(spawnX, spawnY, avatarKey)
      .setScale(this.player.scale)
      .setOrigin(0.5, 1)
      .setDepth(2);

    sprite.body.setAllowGravity(false); // We'll control their position from the server

    const usernameText = this.add.text(spawnX, spawnY - sprite.displayHeight - 10, username, {
        fontSize: '12px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(2);

    this.otherPlayers.set(uid, { sprite, usernameText });
    this.loadingPlayers.delete(uid);
  }
}
