import * as Phaser from "phaser";
import { auth, db } from "../firebase-config.js";
import { doc, updateDoc, setDoc } from "firebase/firestore";

export default class HouseCustomizationScene extends Phaser.Scene {
  constructor() {
    super("HouseCustomizationScene");
    this.houses = Array.from({ length: 8 }, (_, i) => `House${i + 1}.png`);
    this.currentHouseIndex = 0;
  }

  init(data) {
    this.villageId = data.villageId;
  }

  create() {
    this.cameras.main.setBackgroundColor("#7a4841");

    // --- UI Setup ---
    document.getElementById("ui").style.display = "block";
    const customizationUi = document.getElementById("house-customization-menu");
    customizationUi.style.display = "block";

    // Hide other UI elements
    document.getElementById("village-lobby").style.display = "none";

    this.user = auth.currentUser;

    if (!this.user || !this.villageId) {
      this.scene.start("MenuScene");
      return;
    }

    // --- DOM Element References ---
    this.housePreview = document.getElementById("hc-house-preview");
    this.houseNameText = document.getElementById("hc-house-name");
    this.prevHouseButton = document.getElementById("hc-prev-house");
    this.nextHouseButton = document.getElementById("hc-next-house");
    this.confirmButton = document.getElementById("hc-confirm-button");

    // --- Event Listeners ---
    this.boundPrevHouse = this.prevHouse.bind(this);
    this.boundNextHouse = this.nextHouse.bind(this);
    this.boundConfirm = this.confirm.bind(this);

    this.prevHouseButton.addEventListener("click", this.boundPrevHouse);
    this.nextHouseButton.addEventListener("click", this.boundNextHouse);
    this.confirmButton.addEventListener("click", this.boundConfirm);

    this.updateHouseDisplay();
    this.events.on('shutdown', this.shutdown, this);
  }

  updateHouseDisplay() {
    const houseFile = this.houses[this.currentHouseIndex];
    this.housePreview.src = `assets/${houseFile}`;
    this.houseNameText.innerText = `Style ${this.currentHouseIndex + 1}`;
  }

  prevHouse() {
    this.currentHouseIndex = (this.currentHouseIndex - 1 + this.houses.length) % this.houses.length;
    this.updateHouseDisplay();
  }

  nextHouse() {
    this.currentHouseIndex = (this.currentHouseIndex + 1) % this.houses.length;
    this.updateHouseDisplay();
  }

  async confirm() {
    const selectedHouse = this.houses[this.currentHouseIndex];
    const villageRef = doc(db, "villages", this.villageId);
    await updateDoc(villageRef, { [`members.${this.user.uid}.house`]: selectedHouse });

    this.shutdown();
    this.scene.start("VillageScene", { villageId: this.villageId });
  }

  shutdown() {
    document.getElementById("house-customization-menu").style.display = "none";
    this.prevHouseButton.removeEventListener("click", this.boundPrevHouse);
    this.nextHouseButton.removeEventListener("click", this.boundNextHouse);
    this.confirmButton.removeEventListener("click", this.boundConfirm);
  }
}