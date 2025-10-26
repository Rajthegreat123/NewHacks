import * as Phaser from "phaser";
import { getDb, getAuthInstance, getRealtimeDb } from "../firebase-config.js";
import { doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, deleteDoc } from "firebase/firestore";
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
    this.wasMovingX = false; // To track horizontal movement state
    this.interactionText = null; // Text for interaction prompts
    this.closestInteractiveObject = null; // The object the player can interact with
    this.isPanelOpen = false; // State to track if an interaction panel is open
    this.isDomFormOpen = false; // State to track if a DOM form is active
    this.keys = null; // For WASD controls
    this.posts = new Map(); // To store post sprites
    this.expandedPost = null; // To store the currently expanded post view
    this.postCreatorDOM = null; // To store the post creator DOM element
    this.postsData = []; // To cache post data from Firestore
    this.username = "Villager"; // To store the current player's username
    this.exclamationMark = null; // Sprite for the unread posts notification
  }

  preload() {
    // Load all possible player avatars
    this.load.image("ArabCharacter_idle", "assets/ArabCharacter_idle.png");
    this.load.image("AfricanCharacter_idle", "assets/AfricanCharacter_idle.png");
    this.load.image("IndianCharacter_idle", "assets/IndianCharacter_idle.png");
    this.load.image("IndianCharacter_idle", "assets/IndianCharacter_idle.png");
    this.load.image("AfricanCharacter_idle", "assets/AfricanCharacter_idle.png");

    // Load walking animation frames for all characters
    const characterTypes = ['ArabCharacter', 'IndianCharacter', 'AfricanCharacter'];
    characterTypes.forEach(charType => {
      for (let i = 1; i <= 4; i++) {
        this.load.image(`${charType}_run${i}`, `assets/${charType}_run${i}.png`);
      }
    });
    this.load.image("board", "assets/board.png");
    this.load.image("ground", "assets/ground.png");
    this.load.image("post", "assets/post.png");
    this.load.image("emptyscreen", "assets/ScreenEmpty.png");
    this.load.image("exclamation", "assets/exclamation.png");
    this.load.image("InnerHouse", "assets/InnerHouse.png");

    // Load flower assets for planting
    this.load.image("Daffodil4", "assets/Daffodil4.png");
    this.load.image("Daisy4", "assets/Daisy4.png");
    this.load.image("Orchid4", "assets/Orchid4.png");
    this.load.image("Rose4", "assets/Rose4.png");
    this.load.image("Sunflower4", "assets/Sunflower4.png");
    this.load.image("Tulip4", "assets/Tulip4.png");

    // Load planted flower assets
    this.load.image("Daffodil1", "assets/Daffodil1.png");
    this.load.image("Daisy1", "assets/Daisy1.png");
    this.load.image("Orchid1", "assets/Orchid1.png");
    this.load.image("Rose1", "assets/Rose1.png");
    this.load.image("Sunflower1", "assets/Sunflower1.png");
    this.load.image("Tulip1", "assets/Tulip1.png");

    // Load all growth stages for flowers
    const flowerTypes = ['Daffodil', 'Daisy', 'Orchid', 'Rose', 'Sunflower', 'Tulip'];
    flowerTypes.forEach(flower => {
      // Stages 2 and 3. Stage 1 and 4 are already loaded.
      this.load.image(`${flower}2`, `assets/${flower}2.png`);
      this.load.image(`${flower}3`, `assets/${flower}3.png`);
    });

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

    // Disable physics debug drawing
    this.physics.world.drawDebug = false;

    // --- Set Background Color ---
    this.cameras.main.setBackgroundColor('#73bed3');

    // --- Define World Properties ---
    const groundLevel = this.cameras.main.height * 0.85; // Lower 15% is ground
    const spawnHeight = groundLevel - 50; // Spawn players slightly above ground
    const worldWidth = 3000; // a fixed logical world width (independent of screen)

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
    this.username = userData.username || "Villager";
    const avatar = userData.avatar || "ArabCharacter_idle.png";

    const playerAvatarKey = avatar.split('.')[0]; // "ArabCharacter_idle.png" -> "ArabCharacter_idle"

    // --- Create World Elements ---
    const groundHeight = this.cameras.main.height * 0.15;
    this.ground = this.add.tileSprite(worldWidth / 2, Math.round(groundLevel + groundHeight / 2), worldWidth, groundHeight, "ground");
    this.ground.tileScaleX = playerScale;
    this.ground.tileScaleY = playerScale;
    this.textures.get("ground").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.physics.add.existing(this.ground, true); // Make it a static physics body

    // Center the brown box in world space
    const brownBoxX = worldWidth / 2;
    this.brownRectangle = this.add.image(brownBoxX, groundLevel, "board")
      .setOrigin(0.5, 1)
      .setDepth(1).setScale(playerScale); // Scale it relative to the player
    this.textures.get("board").setFilter(Phaser.Textures.FilterMode.NEAREST);

    // --- Create Unread Post Indicator ---
    this.exclamationMark = this.add.image(
        this.brownRectangle.x + this.brownRectangle.displayWidth / 2 - 10, // Position top-right
        this.brownRectangle.y - this.brownRectangle.displayHeight + 25, // Moved down a bit
        'exclamation'
      )
      .setDepth(this.brownRectangle.depth + 1) // Above the board
      .setScale(playerScale * 0.5) // Made it bigger
      .setVisible(false);
    // --- Create Player ---
      this.player = this.physics.add.sprite(this.brownRectangle.x, this.brownRectangle.y - 50, playerAvatarKey)
      .setOrigin(0.5, 1) // Anchor to bottom-center
      .setScale(playerScale)
      .setDepth(2); // Set player depth to be higher than houses
    this.player.setCollideWorldBounds(true);
    this.mainPlayerSprite = this.player; // Store a reference to the main player
    this.textures.get(playerAvatarKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Set the physics body to the original sprite size (e.g., 16x16).
    // Phaser will automatically scale this hitbox along with the visual sprite.
    // If your character has empty space around it in the image, you can use smaller values.
    this.player.body.setSize(10, 16);

    // --- Create Username Text ---
    this.usernameText = this.add.text(this.player.x, this.player.y - this.player.displayHeight - 10, this.username, {
      fontSize: '15px',
      fill: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      fontStyle: 'bold',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(2); // Match player depth

    // --- Create Animations for All Character Types ---
    const characterTypes = ['ArabCharacter', 'IndianCharacter', 'AfricanCharacter'];
    characterTypes.forEach(charType => {
      // Create walk animation
      this.anims.create({
        key: `${charType}_walk`,
        frames: [
          { key: `${charType}_run1` },
          { key: `${charType}_run2` },
          { key: `${charType}_run3` },
          { key: `${charType}_run4` },
        ],
        frameRate: 10,
        repeat: -1 // loop
      });

      // Create idle animation
      this.anims.create({
        key: `${charType}_idle`,
        frames: [{ key: `${charType}_idle` }],
        frameRate: 1,
      });
    });

    // Store the character type for easy access
    this.playerCharacterType = playerAvatarKey.replace('_idle', '');


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

    // --- Interaction Text ---
    this.interactionText = this.add.text(0, 0, "Press 'Space' to Interact", {
      fontSize: '17px',
      fill: '#ffff00', // Yellow text to stand out
      backgroundColor: 'rgba(0, 0, 0, 0)',
      fontStyle: 'bold',
      padding: { x: 8, y: 4 }
    })
    .setOrigin(0.5)
    .setDepth(5) // High depth to appear on top of everything
    .setVisible(false);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keys = this.input.keyboard.addKeys('W,A,D');

    this.connectToVillage();
    this.listenForVillageUpdates();
    this.listenForPosts();
  }

  updatePlayerPosition() {
    if (this.playerRef) {
      set(this.playerRef, {
        x: this.player.x,
        flipX: this.player.flipX,
        yNorm: this.player.y / this.cameras.main.height, // normalized Y (0..1)
        vx: this.player.body.velocity.x, // Also send velocity
      });
    }
  }

  update() {
    // Guard clause to prevent update from running before create() is complete
    if (!this.cursors || !this.player || !this.player.body) return;
    
    // If any UI panel or form is open, freeze the player and stop all other update logic.
    if (this.isPanelOpen || this.isDomFormOpen || this.expandedPost) {
      this.player.setVelocity(0);
      return;
    }

    // Handle interaction logic
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.closestInteractiveObject) {
      if (this.closestInteractiveObject === this.brownRectangle) {
        this.openInteractionPanel();
      } else {
        // It's a house. Find which one.
        for (const [ownerId, houseData] of this.houses.entries()) {
          if (houseData.sprite === this.closestInteractiveObject) {
            // Transition to the InteriorScene, passing the villageId and house owner's ID
            this.scene.start("InteriorScene", { villageId: this.villageId, houseOwnerId: ownerId });
            break;
          }
        }
      }
    }

    let isMoving = false;

    if (this.cursors.left.isDown || this.keys.A.isDown) { // Moving Left
      this.player.setVelocityX(-300);
      this.player.flipX = true;
      isMoving = true;
    } else if (this.cursors.right.isDown || this.keys.D.isDown) { // Moving Right
      this.player.setVelocityX(300);
      this.player.flipX = false;
      isMoving = true;
    } else { // Idle
      this.player.setVelocityX(0);
    }

    if ((this.cursors.up.isDown || this.keys.W.isDown) && this.player.body.blocked.down) { // Jumping
      this.player.setVelocityY(-200);
      isMoving = true;
    }

    // Play walk animation if moving horizontally on the ground
    if (isMoving && this.player.body.velocity.x !== 0 && this.player.body.blocked.down) {
      this.player.play(`${this.playerCharacterType}_walk`, true);
    } else if (!isMoving && this.player.body.blocked.down) {
      // Play idle animation if not moving and on the ground
      this.player.play(`${this.playerCharacterType}_idle`, true);
    }

    this.usernameText.x = this.player.x; // Follow player's X
    this.usernameText.y = this.player.y - this.player.displayHeight - 10; // Position above the scaled player

    const previousY = this.lastY || this.player.y;
    const movedY = Math.abs(this.player.y - previousY) > 2; // only send if y changed meaningfully
    this.lastY = this.player.y;

    const isMovingX = this.player.body.velocity.x !== 0;
    const stoppedMoving = !isMovingX && this.wasMovingX; // Check if we just stopped

    // Send updates if moving, just stopped, or Y changed
    if (isMoving || movedY || stoppedMoving) {
      this.updatePlayerPosition();
    }
    this.wasMovingX = isMovingX;

    // --- Proximity check for interaction ---
    const interactiveObjects = [this.brownRectangle, ...Array.from(this.houses.values()).map(houseData => houseData.sprite)];
    let foundObject = null;
    let minDistance = Infinity;
    const proximityThreshold = 150; // How close the player needs to be to interact

    for (const obj of interactiveObjects) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, obj.x, obj.y);
      if (distance < minDistance) {
        minDistance = distance;
        foundObject = obj;
      }
    }

    if (foundObject && minDistance < proximityThreshold) {
      // Player is close to an object, show and position the text
      this.interactionText.setVisible(true);
      
      // Use a different Y offset for houses vs the main board
      const isHouse = foundObject !== this.brownRectangle;
      const yOffset = isHouse 
        ? foundObject.displayHeight * 0.8 // Position it lower for houses
        : foundObject.displayHeight + 20; // Keep original height for the board

      this.interactionText.setPosition(foundObject.x, foundObject.y - yOffset);
      this.closestInteractiveObject = foundObject;
    } else {
      // Player is not close to any interactive object
      this.interactionText.setVisible(false);
      this.closestInteractiveObject = null;
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

          // Sync animation state for other players
          const otherCharType = existingPlayer.characterType;
          existingPlayer.sprite.flipX = playerData.flipX;
          if (playerData.vx !== 0) {
            existingPlayer.sprite.play(`${otherCharType}_walk`, true);
          } else {
            existingPlayer.sprite.play(`${otherCharType}_idle`, true);
          }

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

  listenForPosts() {
    const postsQuery = query(collection(this.db, "villages", this.villageId, "posts"), orderBy("createdAt", "asc"));
    this.postsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
      this.postsData = [];
      snapshot.forEach(doc => {
        this.postsData.push({ id: doc.id, ...doc.data() });
      });
      // Check if any of the new posts are unread and show the indicator
      this.checkForUnreadPosts();
      // Always re-render when data changes. The function itself will know
      // whether to create new sprites or just update visibility.
      if (this.interactionPanel) {
        this.renderPosts(this.postsData, true);
      }
    });

    // Add cleanup for the posts listener
    this.events.on('shutdown', () => {
      if (this.postsUnsubscribe) {
        this.postsUnsubscribe();
      }
      // Also clean up any post sprites
      this.posts.forEach(post => {
        post.sprite.destroy();
        post.usernameText.destroy();
      });
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

  renderPosts(postsData, forceRecreate = false) {
    // For simplicity, we'll just render. A more robust solution would diff changes.
    // Clear existing posts first
    this.posts.forEach(post => {
      post.sprite.destroy();
      post.usernameText.destroy();
      if (post.notification) post.notification.destroy();
    });
    this.posts.clear();

    if (!this.interactionPanel && !forceRecreate) return; // Can't render if panel isn't open

    const { body } = this.interactionPanel;
    const bodyTop = body.y - body.displayHeight / 2;
    const bodyLeft = body.x - body.displayWidth / 2;
    const rowHeight = body.displayHeight * 0.45;
    const colWidth = body.displayWidth / 5;

    const readPostIds = this.getReadPostIds();

    postsData.forEach((post, index) => {
      if (index >= 10) return; // Max 10 posts

      const row = Math.floor(index / 5); // 0 or 1
      const col = index % 5;

      // Calculate center of the grid box
      const boxCenterX = bodyLeft + col * colWidth + colWidth / 2;
      const boxCenterY = bodyTop + body.displayHeight * 0.10 + row * rowHeight + rowHeight / 2;

      // --- Dynamic Scaling ---
      // 1. Get the original height of the 'post' texture
      const postTexture = this.textures.get('post');
      const originalPostHeight = postTexture.getSourceImage().height;

      // 2. Calculate the target height (75% of the grid cell's height)
      const targetPostHeight = rowHeight * 0.50;

      // 3. Calculate the scale needed to achieve the target height
      const scale = targetPostHeight / originalPostHeight;

      const postSprite = this.add.sprite(boxCenterX, boxCenterY, 'post')
        .setScrollFactor(0)
        .setDepth(body.depth + 1)
        .setScale(scale) // Use the calculated scale
        .setRotation(Phaser.Math.DegToRad(post.rotation))
        .setInteractive({ useHandCursor: true })
        .setVisible(!!this.interactionPanel); // Only visible if panel is open

      // Position the username text directly underneath the post sprite. Use post.username.
      const usernameY = postSprite.y + postSprite.displayHeight / 2 + 5; // 5px padding
      const usernameText = this.add.text(boxCenterX, usernameY, post.username, { fontSize: '12px', fill: '#fff' })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(body.depth + 2);

      postSprite.on('pointerdown', () => this.showExpandedPost(post));

      // --- Add Individual Unread Notification ---
      let notificationSprite = null;
      const isUnread = !readPostIds.includes(post.id) && post.creatorId !== this.user.uid;
      if (isUnread) {
        notificationSprite = this.add.image(
          postSprite.x + postSprite.displayWidth / 2, // Top-right of post
          postSprite.y - postSprite.displayHeight / 2,
          'exclamation'
        )
        .setScrollFactor(0)
        .setDepth(postSprite.depth + 1)
        .setScale(scale * 0.5) // Scale relative to the post sprite
        .setVisible(!!this.interactionPanel); // Ensure it's visible when the panel is open
      }

      this.posts.set(post.id, { sprite: postSprite, usernameText, notification: notificationSprite, data: post });
    });
  }

  async spawnHouses(sortedMembers) {
    const houseBaseHeight = 16;
    const targetHouseHeight = this.cameras.main.height * 0.2;
    const houseScale = targetHouseHeight / houseBaseHeight;

    const gap = 600; // fixed world gap (constant across all screens)
    const brownBoxX = this.brownRectangle.x;

    // Step 1: Remove houses that no longer belong
    this.houses.forEach((houseData, uid) => {
      if (!sortedMembers.find(([id]) => id === uid)) {
        houseData.sprite.destroy();
        if (houseData.text) houseData.text.destroy();
        this.houses.delete(uid);
      }
    });

    // Step 2: Reset counters and reposition all houses (existing or new)
    let leftIndex = 0;
    let rightIndex = 0;

    for (const [uid, memberData] of sortedMembers) {
      if (!memberData.house) continue;

      const groundLevel = this.brownRectangle.y;
      const houseKey = memberData.house.split('.')[0];
      let houseX;

      // Use a consistent index for placement logic
      const memberIndex = sortedMembers.findIndex(([id]) => id === uid);
      if (memberIndex % 2 === 0) {
        houseX = brownBoxX - gap * (leftIndex + 1);
        leftIndex++;
      } else {
        houseX = brownBoxX + gap * (rightIndex + 1);
        rightIndex++;
      }

      let houseData = this.houses.get(uid);

      if (houseData) {
        // Reposition existing house
        houseData.sprite.setPosition(houseX, groundLevel);
        if (houseData.text) {
          houseData.text.setPosition(houseX, groundLevel - houseData.sprite.displayHeight - 10);
        }
      } else {
        // Create new house
        const userDoc = await getDoc(doc(this.db, "users", uid));
        const username = userDoc.exists() ? userDoc.data().username : "Villager";

        const houseSprite = this.add.image(houseX, groundLevel, houseKey)
          .setOrigin(0.5, 1)
          .setScale(houseScale)
          .setDepth(1);
        this.textures.get(houseKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

        const houseText = this.add.text(houseX, groundLevel - houseSprite.displayHeight + 200, `${username}'s House`, {
          fontSize: '17px',
          fill: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          fontStyle: 'bold',
          padding: { x: 6, y: 3 }
        }).setOrigin(0.5).setDepth(2);

        this.houses.set(uid, { sprite: houseSprite, text: houseText });
      }
    }
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
    const characterType = avatarKey.replace('_idle', ''); // Extract character type (e.g., "ArabCharacter")
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

    this.textures.get(avatarKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    sprite.body.setAllowGravity(false); // We'll control their position from the server

    const usernameText = this.add.text(spawnX, spawnY - sprite.displayHeight - 10, username, {
        fontSize: '15px',
        fill: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        fontStyle: 'bold',
        padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(2);

    this.otherPlayers.set(uid, { sprite, usernameText, characterType });
    this.loadingPlayers.delete(uid);
  }

  openInteractionPanel() {
    this.isPanelOpen = true;

    // Mark all current posts as read and hide the notification
    const postIds = this.postsData.map(p => p.id);
    this.markPostsAsRead(postIds);
    this.exclamationMark.setVisible(false);


    this.interactionText.setVisible(false); // Hide the prompt

    // Create the panel centered on the camera
    const panel = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, 'emptyscreen')
      .setScrollFactor(0) // Make it stick to the camera
      .setDepth(10) // Ensure it's on top of other UI
      .setInteractive(); // Allows it to be a target for events if needed

    const targetWidth = this.cameras.main.width * 0.6;
    const scale = targetWidth / panel.width;
    panel.setScale(scale);

    // Add an 'X' button to close the panel
    const closeButton = this.add.text(panel.x + panel.displayWidth / 2 - 16, panel.y - panel.displayHeight / 2 + 120, '×', {
      fontSize: '32px', fill: '#fff', padding: { x: 8, y: 0 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(panel.depth + 1).setInteractive({ useHandCursor: true });

    closeButton.on('pointerdown', () => this.closeInteractionPanel());


    // Add a black rectangle inside the panel to act as a border for the content area
    // The border will be 2% of the panel's width
    const borderWidth = panel.displayWidth * 0.03;
    const bodyWidth = panel.displayWidth - (borderWidth * 2);
    const bodyHeight = panel.displayHeight - (borderWidth * 10.5);

    const bodyContainer = this.add.rectangle(
      panel.x,
      panel.y,
      bodyWidth,
      bodyHeight, // Black color
    ).setScrollFactor(0).setDepth(panel.depth + 1); // Ensure it's on top of the panel
    
    // --- Create Grid Layout inside the Body Container ---
    const graphics = this.add.graphics().setScrollFactor(0).setDepth(bodyContainer.depth + 1);// 2px, white, full alpha

    const bodyTop = bodyContainer.y - bodyContainer.displayHeight / 2;
    const bodyLeft = bodyContainer.x - bodyContainer.displayWidth / 2;
    const bodyRight = bodyContainer.x + bodyContainer.displayWidth / 2;
    const bodyBottom = bodyContainer.y + bodyContainer.displayHeight / 2;

    // Row 1 (10% height) for the "New Post" button
    const row1Y = bodyTop + bodyContainer.displayHeight * 0.10;
    graphics.moveTo(bodyLeft, row1Y);
    graphics.lineTo(bodyRight, row1Y);

    // Row 2 (dividing the remaining 90% in half)
    // This is at 10% + 45% = 55% of the total height
    const row2Y = bodyTop + bodyContainer.displayHeight * 0.55;
    graphics.moveTo(bodyLeft, row2Y);
    graphics.lineTo(bodyRight, row2Y);

    // 5 Columns for the bottom two rows
    const colWidth = bodyContainer.displayWidth / 5;
    for (let i = 1; i < 5; i++) {
      const colX = bodyLeft + colWidth * i;
      // Draw vertical lines only in the bottom two rows
      graphics.moveTo(colX, row1Y);
      graphics.lineTo(colX, bodyBottom);
    }

    // Finalize the lines
    graphics.strokePath();

    // --- Add Buttons to the Panel ---
    const buttonStyle = { fontSize: '16px', fill: '#fff', backgroundColor: '#555', padding: { x: 8, y: 4 } };
    const buttonAreaY = bodyTop + (bodyContainer.displayHeight * 0.10) / 2;

    // "Remove Post" Button
    const removePostButton = this.add.text(bodyRight - 10, buttonAreaY, 'Remove Post', buttonStyle)
      .setOrigin(1, 0.5) // Align to the right and vertical center
      .setScrollFactor(0)
      .setDepth(bodyContainer.depth + 1)
      .setInteractive({ useHandCursor: true });

    // "New Post" Button
    const newPostButton = this.add.text(removePostButton.x - removePostButton.displayWidth - 10, buttonAreaY, 'New Post', buttonStyle)
      .setOrigin(1, 0.5) // Align to the right of the previous button
      .setScrollFactor(0)
      .setDepth(bodyContainer.depth + 1)
      .setInteractive({ useHandCursor: true });

    // Add hover effects
    [newPostButton, removePostButton].forEach(button => {
      button.on('pointerover', () => button.setBackgroundColor('#777'));
      button.on('pointerout', () => button.setBackgroundColor('#555'));
    });

    // --- Button Logic ---
    const userPost = this.postsData.find(p => p.creatorId === this.user.uid);

    if (userPost) {
      // User has a post, so disable "New Post" and enable "Remove Post"
      newPostButton.setAlpha(0.5).disableInteractive();
      removePostButton.on('pointerdown', async () => {
        // Prevent multiple clicks
        removePostButton.disableInteractive().setAlpha(0.5);
        try {
          // Delete the post from Firestore
          const postRef = doc(this.db, "villages", this.villageId, "posts", userPost.id);
          await deleteDoc(postRef);
          // The onSnapshot listener will handle the UI update automatically
          this.closeInteractionPanel(); // Close panel after removal
        } catch (error) {
          console.error("Error removing post:", error);
          // Re-enable button on error
          removePostButton.setInteractive({ useHandCursor: true }).setAlpha(1);
        }
      });
    } else {
      // User does not have a post, enable "New Post" and disable "Remove Post"
      removePostButton.setAlpha(0.5).disableInteractive();
      newPostButton.on('pointerdown', () => this.openPostCreator());
    }

    this.interactionPanel = { main: panel, body: bodyContainer, grid: graphics, newPost: newPostButton, removePost: removePostButton, closeButton: closeButton };

    // Re-render posts and make them visible
    // We need to re-render to ensure posts are visible after being hidden
    this.renderPosts(this.postsData, true);
  }

  closeInteractionPanel() {
    if (this.interactionPanel) {
      this.interactionPanel.main.destroy();
      this.interactionPanel.body.destroy();
      this.interactionPanel.grid.destroy();
      this.interactionPanel.newPost.destroy();
      this.interactionPanel.removePost.destroy();
      this.interactionPanel.closeButton.destroy();
      this.interactionPanel = null;
    }

    // Hide all post sprites and their text
    this.posts.forEach(post => {
      post.sprite.setVisible(false);
      post.usernameText.setVisible(false);
    });

    // Also ensure the post creator is closed if it was open
    if (this.postCreatorDOM) {
      this.postCreatorDOM.destroy();
      this.postCreatorDOM = null;
    }
    this.isPanelOpen = false;
    this.isDomFormOpen = false; // Ensure this is reset
  }

  showExpandedPost(postData) {
    if (this.expandedPost) return; // Don't open if one is already open

    // Semi-transparent background
    const background = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(20).setInteractive();

    // Text content for the post
    const postText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      postData.text,
      {
        fontSize: '20px',
        fill: '#fff',
        backgroundColor: '#333',
        padding: { x: 20, y: 20 },
        wordWrap: { width: this.cameras.main.width * 0.6 },
        align: 'center'
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.expandedPost = { background, text: postText };

    // Close the expanded view when the background is clicked
    background.on('pointerdown', () => this.hideExpandedPost());
  }

  hideExpandedPost() {
    if (this.expandedPost) {
      this.expandedPost.background.destroy();
      this.expandedPost.text.destroy();
      this.expandedPost = null;
    }
  }

  openPostCreator() {
    if (this.postCreatorDOM) return; // Already open

    // Immediately close the interaction panel to prevent visual overlap
    this.closeInteractionPanel();

    this.isDomFormOpen = true; // Set the flag to block game input
    
    // This is a crucial step. It tells Phaser to stop capturing all keyboard events,
    // allowing them to be processed by the HTML form input fields instead.
    this.input.keyboard.disableGlobalCapture();
    this.game.canvas.blur(); // Good practice to also unfocus the canvas

    // HTML content for the form
    const formHTML = `
      <div id="post-creator-form" style="background: #444; padding: 20px; border-radius: 8px; color: white; border: 2px solid #fff; font-family: sans-serif; position: relative;">
        <button id="close-post-creator" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
        <h3>Create a New Post</h3>
        <textarea id="post-text" rows="5" cols="40" placeholder="What's on your mind?" style="width: 100%; box-sizing: border-box;"></textarea>
        <div id="post-upload-status" style="margin-top: 10px; min-height: 1em;"></div>
        <div style="margin-top: 10px; text-align: right;">
          <button id="cancel-post-button" style="margin-right: 10px;">Cancel</button>
          <button id="submit-post-button">Submit</button>
        </div>
      </div>
    `;

    // Create the DOM element in Phaser
    this.postCreatorDOM = this.add.dom(this.cameras.main.centerX, this.cameras.main.centerY).createFromHTML(formHTML);
    this.postCreatorDOM.setScrollFactor(0).setDepth(100);

    const formElement = this.postCreatorDOM.node;
    const submitButton = formElement.querySelector('#submit-post-button');
    const cancelButton = formElement.querySelector('#cancel-post-button');
    const closeButton = formElement.querySelector('#close-post-creator');
    const statusDiv = formElement.querySelector('#post-upload-status');
    const postTextArea = formElement.querySelector('#post-text');

    const closePostCreator = () => {
      const postWasSuccessfullyCreated = statusDiv.textContent === 'Post created!';

      // Destroy the DOM element first
      if (this.postCreatorDOM) {
        this.postCreatorDOM.destroy();
        this.postCreatorDOM = null;
      }

      // If the post was NOT successfully created (e.g., user cancelled),
      // re-open the bulletin board.
      if (!postWasSuccessfullyCreated) {
        // A short delay prevents a flicker and ensures the DOM element is gone
        this.time.delayedCall(50, () => {
          // Reset flags and input listeners only when returning to the game
          this.isDomFormOpen = false;
          this.input.keyboard.enableGlobalCapture();
          this.game.canvas.focus();
          this.openInteractionPanel();
        });
      }
    };

    submitButton.addEventListener('click', async () => {
      const postText = postTextArea.value;
      if (!postText.trim()) {
        statusDiv.textContent = 'Post cannot be empty.';
        return;
      }

      submitButton.disabled = true;
      cancelButton.disabled = true;
      statusDiv.textContent = 'Uploading...';

      try {
        await addDoc(collection(this.db, "villages", this.villageId, "posts"), {
          creatorId: this.user.uid,
          username: this.username,
          text: postText,
          imageUrl: '',
          rotation: Phaser.Math.Between(-20, 20),
          createdAt: serverTimestamp()
        });
        statusDiv.textContent = 'Post created!';
        // After successful creation, we return to the game state.
        this.isDomFormOpen = false;
        this.input.keyboard.enableGlobalCapture();
        this.game.canvas.focus();
        setTimeout(closePostCreator, 1000); // Close the form after a short delay
      } catch (error) {
        console.error("Error creating post:", error);
        statusDiv.textContent = 'Error. Please try again.';
        submitButton.disabled = false;
        cancelButton.disabled = false;
      }
    });

    cancelButton.addEventListener('click', closePostCreator);
    closeButton.addEventListener('click', closePostCreator);
  }

  getReadPostIds() {
    try {
      // Use a key specific to this village to store read posts
      const readPosts = localStorage.getItem(`readPosts_${this.villageId}`);
      return readPosts ? JSON.parse(readPosts) : [];
    } catch (e) {
      console.error("Could not parse read posts from localStorage", e);
      return [];
    }
  }

  markPostsAsRead(postIdsToMark) {
    try {
      const currentReadIds = this.getReadPostIds();
      // Create a new set to avoid duplicates and add the new IDs
      const newReadIds = [...new Set([...currentReadIds, ...postIdsToMark])];
      localStorage.setItem(`readPosts_${this.villageId}`, JSON.stringify(newReadIds));
    } catch (e) {
      console.error("Could not save read posts to localStorage", e);
    }
  }

  checkForUnreadPosts() {
    const readPostIds = this.getReadPostIds();
    // An unread post is one that is not in the read list AND was not created by the current user.
    const hasUnread = this.postsData.some(post => 
      !readPostIds.includes(post.id) && post.creatorId !== this.user.uid);
    this.exclamationMark.setVisible(hasUnread);
  }
}