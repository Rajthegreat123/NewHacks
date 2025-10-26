import * as Phaser from "phaser";
import { getDb, getAuthInstance, getRealtimeDb } from "../firebase-config.js";
import { doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, deleteDoc } from "firebase/firestore";
import { ref, set, onValue, onDisconnect, remove } from "firebase/database";

export default class InteriorScene extends Phaser.Scene {
  constructor() {
    super("InteriorScene");
  }

  init(data) {
    this.villageId = data.villageId;
    this.houseOwnerId = data.houseOwnerId;
    this.otherPlayers = new Map();
    this.playerRef = null;
    this.keys = null;
    this.loadingPlayers = new Set();
    this.username = "Villager";
    this.isPanelOpen = false;
    this.isDomFormOpen = false;
    this.posts = new Map();
    this.expandedPost = null;
    this.postCreatorDOM = null;
    this.postsData = [];
    this.interactionText = null;
    this.closestInteractiveObject = null;
    this.exclamationMark = null;
    this.spaceKey = null;
    this.brownRectangle = null;
  }

  // Preload is not needed here as VillageScene preloads all assets

  async create() {
    this.auth = getAuthInstance();
    this.rtdb = getRealtimeDb();
    this.db = getDb();
    this.user = this.auth.currentUser;
    if (!this.user) return this.scene.start("MenuScene");

    // --- Set Background Color ---
    this.cameras.main.setBackgroundColor('#73bed3');

    // --- Define World Properties ---
    const groundLevel = this.cameras.main.height * 0.85;
    const worldWidth = 1500; // Make the world wider than the screen to allow scrolling

    // --- Scaling Calculations ---
    const playerBaseHeight = 16;
    const targetPlayerHeight = this.cameras.main.height * 0.2;
    const playerScale = targetPlayerHeight / playerBaseHeight;

    // --- Fetch User Data ---
    const userDoc = await getDoc(doc(this.db, "users", this.user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    this.username = userData.username || "Villager";
    const avatar = userData.avatar || "ArabCharacter_idle.png";
    const playerAvatarKey = avatar.split('.')[0];

    // --- Create World Elements ---
    const groundHeight = this.cameras.main.height * 0.15;
    this.ground = this.add.tileSprite(worldWidth / 2, groundLevel + groundHeight / 2, worldWidth, groundHeight, "ground");
    this.ground.tileScaleX = playerScale;
    this.ground.tileScaleY = playerScale;
    this.textures.get("ground").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.physics.add.existing(this.ground, true);

    // --- Create Inner House ---
    const houseCenterX = worldWidth * 0.55;
    const innerHouse = this.add.image(houseCenterX, groundLevel, "InnerHouse")
      .setOrigin(0.5, 1)
      .setDepth(-1);
    const houseTargetHeight = this.cameras.main.height * 0.7;
    const houseScale = houseTargetHeight / innerHouse.height;
    innerHouse.setScale(houseScale);
    this.textures.get("InnerHouse").setFilter(Phaser.Textures.FilterMode.NEAREST);
    
    // --- Create Player ---
    this.player = this.physics.add.sprite(houseCenterX, groundLevel - 50, playerAvatarKey)
      .setOrigin(0.5, 1)
      .setScale(playerScale)
      .setDepth(2);
    this.player.setCollideWorldBounds(true);
    this.textures.get(playerAvatarKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.player.body.setSize(10, 16);

    // --- Create Username Text ---
    this.usernameText = this.add.text(this.player.x, this.player.y - this.player.displayHeight - 10, this.username, {
      fontSize: '15px', fill: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', fontStyle: 'bold', padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(2);

    // --- Physics and Camera ---
    this.physics.add.collider(this.player, this.ground);
    this.physics.world.setBounds(0, 0, worldWidth, this.cameras.main.height);
    this.cameras.main.setBounds(0, 0, worldWidth, this.cameras.main.height);
    this.cameras.main.startFollow(this.player);

    // --- Create Board ---
    const boardX = worldWidth * 0.75; // Position on the left
    this.brownRectangle = this.add.image(boardX, groundLevel, "board")
      .setOrigin(0.5, 1)
      .setDepth(1)
      .setScale(playerScale)
      .setVisible(false); // Make the board image invisible

    this.exclamationMark = this.add.image(
        this.brownRectangle.x + this.brownRectangle.displayWidth / 2 - 10,
        this.brownRectangle.y - this.brownRectangle.displayHeight + 25,
        'exclamation'
      ).setDepth(this.brownRectangle.depth + 1)
      .setScale(playerScale * 0.5)
      .setVisible(false);

    // --- Controls ---
    this.keys = this.input.keyboard.addKeys('W,A,D');
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // --- Exit Door ---
    const exitDoor = this.add.zone(worldWidth * 0.9, groundLevel, 100, 200).setOrigin(0.5, 1);
    this.physics.add.existing(exitDoor, true);

    const exitText = this.add.text(exitDoor.x, exitDoor.y - exitDoor.height - 20, "Press 'W' or 'Up' to Exit", {
        fontSize: '17px', fill: '#ffff00', fontStyle: 'bold', backgroundColor: 'rgba(0,0,0,0.7)'
    }).setOrigin(0.5).setVisible(false);

    this.physics.add.overlap(this.player, exitDoor, () => {
        exitText.setVisible(true);
        if (this.keys.W.isDown || this.cursors.up.isDown) {
            this.scene.start("VillageScene", { villageId: this.villageId });
        }
    }, null, this);

    // Hide text when not overlapping
    this.physics.world.on('worldstep', () => {
        if (!this.physics.overlap(this.player, exitDoor)) {
            exitText.setVisible(false);
        }
    });

    // --- Interaction Text ---
    this.interactionText = this.add.text(0, 0, "Press 'Space' to Interact", {
      fontSize: '17px', fill: '#ffff00', fontStyle: 'bold', padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(5).setVisible(false);

    this.connectToHouse();
    this.listenForPosts();
  }

  update() {
    if (!this.player || !this.player.body) return;

    if (this.isPanelOpen || this.isDomFormOpen || this.expandedPost) {
      this.player.setVelocity(0);
      return;
    }

    // Handle interaction logic
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.closestInteractiveObject) {
      if (this.closestInteractiveObject === this.brownRectangle) {
        this.openInteractionPanel();
      }
    }

    // --- Proximity check for interaction ---
    const interactiveObjects = [this.brownRectangle]; // Only the board is interactive inside
    let foundObject = null;
    let minDistance = Infinity;
    const proximityThreshold = 150;

    for (const obj of interactiveObjects) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, obj.x, obj.y);
      if (distance < minDistance) {
        minDistance = distance;
        foundObject = obj;
      }
    }

    this.handleProximity(foundObject, minDistance, proximityThreshold);

    let isMoving = false;

    if (this.cursors.left.isDown || this.keys.A.isDown) {
      this.player.setVelocityX(-300);
      this.player.flipX = true;
      isMoving = true;
    } else if (this.cursors.right.isDown || this.keys.D.isDown) {
      this.player.setVelocityX(300);
      this.player.flipX = false;
      isMoving = true;
    } else {
      this.player.setVelocityX(0);
    }

    if ((this.cursors.up.isDown || this.keys.W.isDown) && this.player.body.blocked.down) { // Jumping
      this.player.setVelocityY(-200);
      isMoving = true;
    }

    // Animation logic similar to VillageScene
    if (isMoving && this.player.body.velocity.x !== 0 && this.player.body.blocked.down) {
      this.player.play('arab_walk', true);
    } else if (!isMoving && this.player.body.blocked.down) {
      this.player.play('arab_idle', true);
    }

    this.usernameText.setPosition(this.player.x, this.player.y - this.player.displayHeight - 10);

    this.updatePlayerPosition();
  }

  handleProximity(foundObject, minDistance, proximityThreshold) {
    if (foundObject && minDistance < proximityThreshold) {
      this.interactionText.setVisible(true);
      const yOffset = foundObject.displayHeight + 20;
      this.interactionText.setPosition(foundObject.x, foundObject.y - yOffset);
      this.closestInteractiveObject = foundObject;
    } else {
      this.interactionText.setVisible(false);
      this.closestInteractiveObject = null;
    }
  }

  updatePlayerPosition() {
    if (this.playerRef) {
      set(this.playerRef, {
        x: this.player.x,
        flipX: this.player.flipX,
        yNorm: this.player.y / this.cameras.main.height, // normalized Y (0..1)
        vx: this.player.body.velocity.x,
      });
    }
  }

  connectToHouse() {
    const housePlayersRefPath = `villages/${this.villageId}/houses/${this.houseOwnerId}/players`;
    const housePlayersRef = ref(this.rtdb, housePlayersRefPath);
    this.playerRef = ref(this.rtdb, `${housePlayersRefPath}/${this.user.uid}`);

    onDisconnect(this.playerRef).remove();

    onValue(housePlayersRef, (snapshot) => {
      const serverPlayers = snapshot.val() || {};
      const serverPlayerIds = Object.keys(serverPlayers);

      // Update or create other players
      Object.entries(serverPlayers).forEach(([uid, playerData]) => {
        if (uid === this.user.uid) return;

        if (this.otherPlayers.has(uid)) {
          const existingPlayer = this.otherPlayers.get(uid);

          const targetX = playerData.x;
          const targetY = (typeof playerData.yNorm === 'number')
            ? playerData.yNorm * this.cameras.main.height
            : existingPlayer.sprite.y;

          this.tweens.add({
            targets: existingPlayer.sprite,
            x: targetX,
            y: targetY,
            duration: 100,
            ease: 'Linear'
          });

          existingPlayer.sprite.flipX = playerData.flipX;
          if (playerData.vx !== 0) {
            existingPlayer.sprite.play('arab_walk', true);
          } else {
            existingPlayer.sprite.play('arab_idle', true);
          }
          existingPlayer.usernameText.setPosition(targetX, targetY - existingPlayer.sprite.displayHeight - 10);
        } else {
          this.createOtherPlayer(uid, playerData);
        }
      });

      // Remove players who have left
      this.otherPlayers.forEach((player, uid) => {
        if (!serverPlayerIds.includes(uid)) {
          player.sprite.destroy();
          player.usernameText.destroy();
          this.otherPlayers.delete(uid);
        }
      });
    });

    this.events.on('shutdown', () => {
      if (this.playerRef) {
        remove(this.playerRef);
      }
      if (this.postsUnsubscribe) {
        this.postsUnsubscribe();
      }
      this.posts.forEach(post => {
        if (post.sprite) post.sprite.destroy();
      });
    });
  }

  async createOtherPlayer(uid, playerData) {
    // Prevent creating duplicate sprites if updates arrive quickly
    if (this.otherPlayers.has(uid) || this.loadingPlayers.has(uid)) return;
    this.loadingPlayers.add(uid);

    // Fetch user data for avatar and username
    const userDoc = await getDoc(doc(this.db, "users", uid));
    if (!userDoc.exists()) {
      this.loadingPlayers.delete(uid); // Clean up if user doc not found
      return;
    }

    const otherUserData = userDoc.data();
    const avatarKey = (otherUserData.avatar || "ArabCharacter_idle.png").split('.')[0];
    const username = otherUserData.username || "Villager";

    const spawnX = playerData.x || this.cameras.main.width / 2;
    const spawnY = (typeof playerData.yNorm === 'number')
      ? playerData.yNorm * this.cameras.main.height
      : this.cameras.main.height * 0.85 - 50;


    const sprite = this.physics.add.sprite(spawnX, spawnY, avatarKey)
      .setScale(this.player.scale)
      .setOrigin(0.5, 1)
      .setDepth(2);

    // Create animations for the new player sprite, just like in VillageScene
    sprite.anims.create({
      key: 'arab_idle',
      frames: [{ key: 'ArabCharacter_idle' }],
      frameRate: 1
    });

    sprite.anims.create({
      key: 'arab_walk',
      frames: [
        { key: 'ArabCharacter_run1' },
        { key: 'ArabCharacter_run2' },
        { key: 'ArabCharacter_run3' },
        { key: 'ArabCharacter_run4' },
      ],
      frameRate: 10,
      repeat: -1
    });

    this.textures.get(avatarKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    sprite.body.setAllowGravity(false);

    const usernameText = this.add.text(spawnX, spawnY - sprite.displayHeight - 10, username, {
        fontSize: '15px', fill: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', fontStyle: 'bold', padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(2);

    this.otherPlayers.set(uid, { sprite, usernameText });
    this.loadingPlayers.delete(uid); // Mark loading as complete
  }

  // --- POSTS AND INTERACTION PANEL LOGIC ---

  listenForPosts() {
    const postsQuery = query(collection(this.db, "villages", this.villageId, "houses", this.houseOwnerId, "posts"), orderBy("createdAt", "asc"));
    this.postsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
      this.postsData = [];
      snapshot.forEach(doc => {
        this.postsData.push({ id: doc.id, ...doc.data() });
      });
      this.checkForUnreadPosts();
      if (this.interactionPanel) {
        this.renderPosts(this.postsData, true);
      }
    });
  }

  renderPosts(postsData, forceRecreate = false) {
    this.posts.forEach(post => {
      post.sprite.destroy();
      post.usernameText.destroy();
      if (post.notification) post.notification.destroy();
    });
    this.posts.clear();

    if (!this.interactionPanel && !forceRecreate) return;

    const { body } = this.interactionPanel;
    const bodyTop = body.y - body.displayHeight / 2;
    const bodyLeft = body.x - body.displayWidth / 2;
    const rowHeight = body.displayHeight * 0.45;
    const colWidth = body.displayWidth / 5;

    const readPostIds = this.getReadPostIds();

    postsData.forEach((post, index) => {
      if (index >= 10) return;

      const row = Math.floor(index / 5);
      const col = index % 5;

      const boxCenterX = bodyLeft + col * colWidth + colWidth / 2;
      const boxCenterY = bodyTop + body.displayHeight * 0.10 + row * rowHeight + rowHeight / 2;

      const postTexture = this.textures.get('post');
      const originalPostHeight = postTexture.getSourceImage().height;
      const targetPostHeight = rowHeight * 0.50;
      const scale = targetPostHeight / originalPostHeight;

      const postSprite = this.add.sprite(boxCenterX, boxCenterY, 'post')
        .setScrollFactor(0).setDepth(body.depth + 1).setScale(scale)
        .setRotation(Phaser.Math.DegToRad(post.rotation))
        .setInteractive({ useHandCursor: true }).setVisible(!!this.interactionPanel);

      const usernameY = postSprite.y + postSprite.displayHeight / 2 + 5;
      const usernameText = this.add.text(boxCenterX, usernameY, post.username, { fontSize: '12px', fill: '#fff' })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(body.depth + 2);

      postSprite.on('pointerdown', () => this.showExpandedPost(post));

      let notificationSprite = null;
      const isUnread = !readPostIds.includes(post.id) && post.creatorId !== this.user.uid;
      if (isUnread) {
        notificationSprite = this.add.image(
          postSprite.x + postSprite.displayWidth / 2,
          postSprite.y - postSprite.displayHeight / 2,
          'exclamation'
        ).setScrollFactor(0).setDepth(postSprite.depth + 1).setScale(scale * 0.5).setVisible(!!this.interactionPanel);
      }

      this.posts.set(post.id, { sprite: postSprite, usernameText, notification: notificationSprite, data: post });
    });
  }

  openInteractionPanel() {
    this.isPanelOpen = true;
    const postIds = this.postsData.map(p => p.id);
    this.markPostsAsRead(postIds);
    this.exclamationMark.setVisible(false);
    this.interactionText.setVisible(false);

    const panel = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, 'emptyscreen')
      .setScrollFactor(0).setDepth(10).setInteractive();

    const targetWidth = this.cameras.main.width * 0.6;
    const scale = targetWidth / panel.width;
    panel.setScale(scale);

    const closeButton = this.add.text(panel.x + panel.displayWidth / 2 - 16, panel.y - panel.displayHeight / 2 + 120, '×', {
      fontSize: '32px', fill: '#fff', padding: { x: 8, y: 0 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(panel.depth + 1).setInteractive({ useHandCursor: true });

    closeButton.on('pointerdown', () => this.closeInteractionPanel());

    const borderWidth = panel.displayWidth * 0.03;
    const bodyWidth = panel.displayWidth - (borderWidth * 2);
    const bodyHeight = panel.displayHeight - (borderWidth * 10.5);

    const bodyContainer = this.add.rectangle(panel.x, panel.y, bodyWidth, bodyHeight)
      .setScrollFactor(0).setDepth(panel.depth + 1);

    const graphics = this.add.graphics().setScrollFactor(0).setDepth(bodyContainer.depth + 1);
    const bodyTop = bodyContainer.y - bodyContainer.displayHeight / 2;
    const bodyLeft = bodyContainer.x - bodyContainer.displayWidth / 2;
    const bodyRight = bodyContainer.x + bodyContainer.displayWidth / 2;
    const bodyBottom = bodyContainer.y + bodyContainer.displayHeight / 2;

    const row1Y = bodyTop + bodyContainer.displayHeight * 0.10;
    graphics.moveTo(bodyLeft, row1Y).lineTo(bodyRight, row1Y);
    const row2Y = bodyTop + bodyContainer.displayHeight * 0.55;
    graphics.moveTo(bodyLeft, row2Y).lineTo(bodyRight, row2Y);

    const colWidth = bodyContainer.displayWidth / 5;
    for (let i = 1; i < 5; i++) {
      const colX = bodyLeft + colWidth * i;
      graphics.moveTo(colX, row1Y).lineTo(colX, bodyBottom);
    }
    graphics.strokePath();

    let newPostButton, removePostButton;

    // --- Button Logic: Only the house owner can manage posts ---
    if (this.user.uid === this.houseOwnerId) {
      const buttonStyle = { fontSize: '16px', fill: '#fff', backgroundColor: '#555', padding: { x: 8, y: 4 } };
      const buttonAreaY = bodyTop + (bodyContainer.displayHeight * 0.10) / 2;

      removePostButton = this.add.text(bodyRight - 10, buttonAreaY, 'Remove All Posts', buttonStyle)
        .setOrigin(1, 0.5).setScrollFactor(0).setDepth(bodyContainer.depth + 1).setInteractive({ useHandCursor: true });

      newPostButton = this.add.text(removePostButton.x - removePostButton.displayWidth - 10, buttonAreaY, 'New Post', buttonStyle)
        .setOrigin(1, 0.5).setScrollFactor(0).setDepth(bodyContainer.depth + 1).setInteractive({ useHandCursor: true });

      newPostButton.on('pointerdown', () => this.openPostCreator());

      [newPostButton, removePostButton].forEach(button => {
        button.on('pointerover', () => button.setBackgroundColor('#777'));
        button.on('pointerout', () => button.setBackgroundColor('#555'));
      });

      const ownerPosts = this.postsData.filter(p => p.creatorId === this.houseOwnerId);

      if (ownerPosts.length > 0) {
        removePostButton.on('pointerdown', async () => {
          removePostButton.disableInteractive().setAlpha(0.5);
          try {
            for (const post of ownerPosts) {
              const postRef = doc(this.db, "villages", this.villageId, "houses", this.houseOwnerId, "posts", post.id);
              await deleteDoc(postRef);
            }
            this.closeInteractionPanel();
          } catch (error) {
            console.error("Error removing posts:", error);
            removePostButton.setInteractive({ useHandCursor: true }).setAlpha(1);
          }
        });
      } else {
        removePostButton.setAlpha(0.5).disableInteractive();
      }
    }

    this.interactionPanel = { main: panel, body: bodyContainer, grid: graphics, newPost: newPostButton, removePost: removePostButton, closeButton: closeButton };
    this.renderPosts(this.postsData, true);
  }

  closeInteractionPanel() {
    if (this.interactionPanel) {
      this.interactionPanel.main.destroy();
      this.interactionPanel.body.destroy();
      this.interactionPanel.grid.destroy();
      if (this.interactionPanel.newPost) this.interactionPanel.newPost.destroy();
      if (this.interactionPanel.removePost) this.interactionPanel.removePost.destroy();
      this.interactionPanel.closeButton.destroy();
      this.interactionPanel = null;
    }

    this.posts.forEach(post => {
      post.sprite.setVisible(false);
      post.usernameText.setVisible(false);
    });

    if (this.postCreatorDOM) {
      this.postCreatorDOM.destroy();
      this.postCreatorDOM = null;
    }
    this.isPanelOpen = false;
    this.isDomFormOpen = false;
  }

  showExpandedPost(postData) {
    if (this.expandedPost) return;

    const background = this.add.rectangle(
      this.cameras.main.centerX, this.cameras.main.centerY,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(20).setInteractive();

    const postText = this.add.text(
      this.cameras.main.centerX, this.cameras.main.centerY, postData.text,
      {
        fontSize: '20px', fill: '#fff', backgroundColor: '#333',
        padding: { x: 20, y: 20 }, wordWrap: { width: this.cameras.main.width * 0.6 }, align: 'center'
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.expandedPost = { background, text: postText };
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
    if (this.postCreatorDOM) return;
    this.closeInteractionPanel();
    this.isDomFormOpen = true;
    this.input.keyboard.disableGlobalCapture();
    this.game.canvas.blur();

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
      if (this.postCreatorDOM) {
        this.postCreatorDOM.destroy();
        this.postCreatorDOM = null;
      }
      if (!postWasSuccessfullyCreated) {
        this.time.delayedCall(50, () => {
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
        await addDoc(collection(this.db, "villages", this.villageId, "houses", this.houseOwnerId, "posts"), {
          creatorId: this.user.uid,
          username: this.username,
          text: postText,
          imageUrl: '',
          rotation: Phaser.Math.Between(-20, 20),
          createdAt: serverTimestamp()
        });
        statusDiv.textContent = 'Post created!';
        this.isDomFormOpen = false;
        this.input.keyboard.enableGlobalCapture();
        this.game.canvas.focus();
        setTimeout(closePostCreator, 1000);
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
      const readPosts = localStorage.getItem(`readPosts_${this.villageId}_${this.houseOwnerId}`);
      return readPosts ? JSON.parse(readPosts) : [];
    } catch (e) {
      console.error("Could not parse read posts from localStorage", e);
      return [];
    }
  }

  markPostsAsRead(postIdsToMark) {
    try {
      const currentReadIds = this.getReadPostIds();
      const newReadIds = [...new Set([...currentReadIds, ...postIdsToMark])];
      localStorage.setItem(`readPosts_${this.villageId}_${this.houseOwnerId}`, JSON.stringify(newReadIds));
    } catch (e) {
      console.error("Could not save read posts to localStorage", e);
    }
  }

  checkForUnreadPosts() {
    const readPostIds = this.getReadPostIds();
    const hasUnread = this.postsData.some(post =>
      !readPostIds.includes(post.id) && post.creatorId !== this.user.uid);
    this.exclamationMark.setVisible(hasUnread);
  }
}