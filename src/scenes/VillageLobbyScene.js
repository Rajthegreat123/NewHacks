import * as Phaser from "phaser";
import { getAuthInstance, getDb } from "../firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  addDoc,
} from "firebase/firestore";

export default class VillageLobbyScene extends Phaser.Scene {
  constructor() {
    super("VillageLobbyScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#333");

    document.getElementById("ui").style.display = "block";
    const lobbyUi = document.getElementById("village-lobby");
    lobbyUi.style.display = "block";


    // Hide other UI elements if they are visible
    document.getElementById("login-form").style.display = "none";
    document.getElementById("signup-form").style.display = "none";
    this.auth = getAuthInstance();
    this.db = getDb();
    this.user = this.auth.currentUser;

    if (!this.user) {
      alert("You are not logged in!");
      // Potentially redirect to MenuScene
      lobbyUi.style.display = "none";
      this.scene.start("MenuScene");
      return;
    }

    this.myVillagesList = document.getElementById("my-villages-list");
    this.joinVillageButton = document.getElementById("join-village-button");
    this.createVillageButton = document.getElementById("create-village-button");

    this.boundJoinVillage = this.joinVillage.bind(this);
    this.boundCreateVillage = this.createVillage.bind(this);

    this.joinVillageButton.addEventListener("click", this.boundJoinVillage);
    this.createVillageButton.addEventListener("click", this.boundCreateVillage);

    this.fetchUserVillages();

    this.events.on('shutdown', this.shutdown, this);
  }

  async fetchUserVillages() {
    const userDocRef = doc(this.db, "users", this.user.uid);
    const userDoc = await getDoc(userDocRef);

    const villageIds = userDoc.exists() ? userDoc.data().villages || [] : [];

    if (villageIds.length > 0) {
      this.myVillagesList.innerHTML = "<h3>My Villages</h3>"; // Reset

      const villagePromises = villageIds.map(id => getDoc(doc(this.db, "villages", id)));
      const villageDocs = await Promise.all(villagePromises);

      villageDocs.forEach((villageDoc, index) => {
        const villageId = villageIds[index];
        const villageName = villageDoc.exists() ? villageDoc.data().name : `Unknown Village (${villageId})`;
        const villageElement = document.createElement("button");
        villageElement.innerText = villageName;
        villageElement.onclick = () => this.enterVillage(villageId);
        this.myVillagesList.appendChild(villageElement);
      });
    } else {
      this.myVillagesList.innerHTML = "<h3>My Villages</h3><p>No joined villages.</p>";
    }
  }

  async joinVillage() {
    const villageId = document.getElementById("join-village-id").value;
    if (!villageId) {
      alert("Please enter a Village ID.");
      return;
    }

    const villageRef = doc(this.db, "villages", villageId);
    const villageDoc = await getDoc(villageRef);

    if (!villageDoc.exists()) {
      alert(`Village with ID "${villageId}" does not exist.`);
      return;
    }

    const villageData = villageDoc.data();
    if (villageData.members && villageData.members.includes(this.user.uid)) {
        alert("You are already in this village!");
        this.enterVillage(villageId);
        return;
    }

    // Add user to the village's member list and village to user's village list
    await updateDoc(villageRef, { members: arrayUnion(this.user.uid) });
    await updateDoc(doc(this.db, "users", this.user.uid), { villages: arrayUnion(villageId) });

    alert(`Successfully joined village: ${villageData.name}`);
    this.fetchUserVillages(); // Refresh the list
  }

  async createVillage() {
    const villageName = prompt("Enter a name for your new village:");
    if (!villageName) return;

    const villagesCol = collection(this.db, "villages");
    const newVillageDoc = await addDoc(villagesCol, {
      name: villageName,
      owner: this.user.uid,
      members: [this.user.uid],
    });

    await updateDoc(doc(this.db, "users", this.user.uid), { villages: arrayUnion(newVillageDoc.id) });    
    this.scene.start("CustomizationScene", { villageId: newVillageDoc.id });
  }

  enterVillage(villageId) {
    this.shutdown(); // Clean up listeners before leaving the scene
    this.scene.start("VillageScene", { villageId });
  }

  shutdown() {
    document.getElementById("village-lobby").style.display = "none";
    this.joinVillageButton.removeEventListener("click", this.boundJoinVillage);
    this.createVillageButton.removeEventListener("click", this.boundCreateVillage);
  }
}