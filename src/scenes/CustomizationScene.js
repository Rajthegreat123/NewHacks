import * as Phaser from "phaser";
import { getAuthInstance, getDb } from "../firebase-config.js";
import { doc, updateDoc } from "firebase/firestore";

export default class CustomizationScene extends Phaser.Scene {
  constructor() {
    super("CustomizationScene");
    this.avatars = ["player1.png", "player2.png", "player3.png"];
    this.avatarNames = ["Adventurer", "Villager", "Wizard"];
    this.currentAvatarIndex = 0;
  }

  init(data) {
    this.villageId = data.villageId;
  }

  create() {
    this.cameras.main.setBackgroundColor("#333");

    // --- UI Setup ---
    document.getElementById("ui").style.display = "block";
    const customizationUi = document.getElementById("customization-menu");
    customizationUi.style.display = "block";

    // Hide other UI elements
    document.getElementById("village-lobby").style.display = "none";

    this.auth = getAuthInstance();
    this.db = getDb();
    this.user = this.auth.currentUser;

    if (!this.user) {
      this.scene.start("MenuScene");
      return;
    }

    // --- DOM Element References ---
    this.avatarPreview = document.getElementById("avatar-preview");
    this.avatarNameText = document.getElementById("avatar-name");
    this.prevButton = document.getElementById("prev-avatar");
    this.nextButton = document.getElementById("next-avatar");
    this.confirmButton = document.getElementById("confirm-customization-button");

    // --- Event Listeners ---
    this.boundPrevAvatar = this.prevAvatar.bind(this);
    this.boundNextAvatar = this.nextAvatar.bind(this);
    this.boundConfirm = this.confirm.bind(this);

    this.prevButton.addEventListener("click", this.boundPrevAvatar);
    this.nextButton.addEventListener("click", this.boundNextAvatar);
    this.confirmButton.addEventListener("click", this.boundConfirm);

    this.updateAvatarDisplay();

    this.events.on('shutdown', this.shutdown, this);
  }

  updateAvatarDisplay() {
    const avatarFile = this.avatars[this.currentAvatarIndex];
    this.avatarPreview.src = `assets/${avatarFile}`;
    this.avatarNameText.innerText = this.avatarNames[this.currentAvatarIndex];
  }

  prevAvatar() {
    this.currentAvatarIndex--;
    if (this.currentAvatarIndex < 0) {
      this.currentAvatarIndex = this.avatars.length - 1;
    }
    this.updateAvatarDisplay();
  }

  nextAvatar() {
    this.currentAvatarIndex++;
    if (this.currentAvatarIndex >= this.avatars.length) {
      this.currentAvatarIndex = 0;
    }
    this.updateAvatarDisplay();
  }

  async confirm() {
    const selectedAvatar = this.avatars[this.currentAvatarIndex];
    const userDocRef = doc(this.db, "users", this.user.uid);
    await updateDoc(userDocRef, { avatar: selectedAvatar });

    this.shutdown();
    this.scene.start("VillageScene", { villageId: this.villageId });
  }

  shutdown() {
    document.getElementById("customization-menu").style.display = "none";
    this.prevButton.removeEventListener("click", this.boundPrevAvatar);
    this.nextButton.removeEventListener("click", this.boundNextAvatar);
    this.confirmButton.removeEventListener("click", this.boundConfirm);
  }
}