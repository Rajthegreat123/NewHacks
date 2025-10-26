import * as Phaser from "phaser";
import { getAuthInstance, getDb } from "../firebase-config.js";
import { doc, updateDoc } from "firebase/firestore";

export default class CustomizationScene extends Phaser.Scene {
  constructor() {
    super("CustomizationScene");
    this.avatars = ["ArabCharacter_idle.png", "AfricanCharacter1.png", "IndianCharacter1.png"]; // Using your specified avatar
    this.avatarNames = ["Adventurer", "Villager", "Wizard"];
    this.currentAvatarIndex = 0;

    this.houses = Array.from({ length: 8 }, (_, i) => `House${i + 1}.png`);
    this.currentHouseIndex = 0;
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

    this.housePreview = document.getElementById("house-preview");
    this.houseNameText = document.getElementById("house-name");
    this.prevHouseButton = document.getElementById("prev-house");
    this.nextHouseButton = document.getElementById("next-house");

    this.confirmButton = document.getElementById("confirm-customization-button");

    // --- Event Listeners ---
    this.boundPrevAvatar = this.prevAvatar.bind(this);
    this.boundNextAvatar = this.nextAvatar.bind(this);
    this.boundPrevHouse = this.prevHouse.bind(this);
    this.boundNextHouse = this.nextHouse.bind(this);
    this.boundConfirm = this.confirm.bind(this);

    this.prevButton.addEventListener("click", this.boundPrevAvatar);
    this.nextButton.addEventListener("click", this.boundNextAvatar);
    this.prevHouseButton.addEventListener("click", this.boundPrevHouse);
    this.nextHouseButton.addEventListener("click", this.boundNextHouse);
    this.confirmButton.addEventListener("click", this.boundConfirm);

    this.updateAvatarDisplay();
    this.updateHouseDisplay();

    this.events.on('shutdown', this.shutdown, this);
  }

  updateAvatarDisplay() {
    const avatarFile = this.avatars[this.currentAvatarIndex];
    this.avatarPreview.src = `assets/${avatarFile}`;
    this.avatarNameText.innerText = this.avatarNames[this.currentAvatarIndex];
  }

  updateHouseDisplay() {
    const houseFile = this.houses[this.currentHouseIndex];
    this.housePreview.src = `assets/${houseFile}`;
    this.houseNameText.innerText = `Style ${this.currentHouseIndex + 1}`;
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

  prevHouse() {
    this.currentHouseIndex--;
    if (this.currentHouseIndex < 0) {
      this.currentHouseIndex = this.houses.length - 1;
    }
    this.updateHouseDisplay();
  }

  nextHouse() {
    this.currentHouseIndex++;
    if (this.currentHouseIndex >= this.houses.length) {
      this.currentHouseIndex = 0;
    }
    this.updateHouseDisplay();
  }

  async confirm() {
    const selectedAvatar = this.avatars[this.currentAvatarIndex];
    const selectedHouse = this.houses[this.currentHouseIndex];
    const userDocRef = doc(this.db, "users", this.user.uid);

    // Save both avatar and house selection
    await updateDoc(userDocRef, { avatar: selectedAvatar, house: selectedHouse });

    this.shutdown();
    this.scene.start("VillageScene", { villageId: this.villageId });
  }

  shutdown() {
    document.getElementById("customization-menu").style.display = "none";
    this.prevButton.removeEventListener("click", this.boundPrevAvatar);
    this.nextButton.removeEventListener("click", this.boundNextAvatar);
    this.prevHouseButton.removeEventListener("click", this.boundPrevHouse);
    this.nextHouseButton.removeEventListener("click", this.boundNextHouse);
    this.confirmButton.removeEventListener("click", this.boundConfirm);
  }
}