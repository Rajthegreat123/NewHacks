import * as Phaser from "phaser";
import { auth, db } from "../firebase-config.js";
import { doc, updateDoc } from "firebase/firestore";

export default class AvatarCustomizationScene extends Phaser.Scene {
  constructor() {
    super("AvatarCustomizationScene");
    this.avatars = ["ArabCharacter_idle.png", "AfricanCharacter_idle.png", "IndianCharacter_idle.png"];
    this.currentAvatarIndex = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor("#7a4841");

    // --- UI Setup ---
    document.getElementById("ui").style.display = "block";
    const customizationUi = document.getElementById("avatar-customization-menu");
    customizationUi.style.display = "block";

    // Hide other UI elements
    document.getElementById("login-form").style.display = "none";
    document.getElementById("signup-form").style.display = "none";

    this.user = auth.currentUser;

    if (!this.user) {
      this.scene.start("MenuScene");
      return;
    }

    // --- DOM Element References ---
    this.avatarPreview = document.getElementById("ac-avatar-preview");
    this.prevButton = document.getElementById("ac-prev-avatar");
    this.nextButton = document.getElementById("ac-next-avatar");
    this.confirmButton = document.getElementById("ac-confirm-button");

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
  }

  prevAvatar() {
    this.currentAvatarIndex = (this.currentAvatarIndex - 1 + this.avatars.length) % this.avatars.length;
    this.updateAvatarDisplay();
  }

  nextAvatar() {
    this.currentAvatarIndex = (this.currentAvatarIndex + 1) % this.avatars.length;
    this.updateAvatarDisplay();
  }

  async confirm() {
    const selectedAvatar = this.avatars[this.currentAvatarIndex];
    const userDocRef = doc(db, "users", this.user.uid);
    await updateDoc(userDocRef, { avatar: selectedAvatar });

    this.shutdown();
    this.scene.start("VillageLobbyScene");
  }

  shutdown() {
    document.getElementById("avatar-customization-menu").style.display = "none";
    this.prevButton.removeEventListener("click", this.boundPrevAvatar);
    this.nextButton.removeEventListener("click", this.boundNextAvatar);
    this.confirmButton.removeEventListener("click", this.boundConfirm);
  }
}