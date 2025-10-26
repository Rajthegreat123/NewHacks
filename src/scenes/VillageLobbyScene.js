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
  query,
  where,
  getDocs,
} from "firebase/firestore";

export default class VillageLobbyScene extends Phaser.Scene {
  constructor() {
    super("VillageLobbyScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#7a4841");

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
    const joinCode = document.getElementById("join-village-id").value.trim().toUpperCase();
    if (!joinCode || joinCode.length !== 5) {
      alert("Please enter a valid 5-character village code.");
      return;
    }

    // Query for the village with the matching code
    const villagesRef = collection(this.db, "villages");
    const q = query(villagesRef, where("villageCode", "==", joinCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert(`No village found with code "${joinCode}".`);
      return;
    }

    // Get the full village document and its ID
    const villageDoc = querySnapshot.docs[0];
    const villageId = villageDoc.id;
    const villageData = villageDoc.data();
    const villageRef = villageDoc.ref;

    // Check if the user is already a member
    if (villageData.members && villageData.members[this.user.uid]) {
        alert("You are already in this village!");
        this.enterVillage(villageId);
        return;
    }

    // Add user to the village's member list and village to user's village list
    // We set a placeholder for the house, which will be chosen in the next scene
    await updateDoc(villageRef, { [`members.${this.user.uid}`]: { joined: new Date() } });
    await updateDoc(doc(this.db, "users", this.user.uid), { villages: arrayUnion(villageId) });

    alert(`Successfully joined village: ${villageData.name}`);
    
    // Go to house customization
    this.scene.start("HouseCustomizationScene", { villageId: villageId });
  }

  async createVillage() {
    const villageName = prompt("Enter a name for your new village:");
    if (!villageName) return;

    // Create a reference to a new document to get its ID before saving
    const newVillageRef = doc(collection(this.db, "villages"));
    const villageId = newVillageRef.id;
    const villageCode = villageId.substring(0, 5).toUpperCase();

    // Now set the data for the new village, including the code
    await setDoc(newVillageRef, {
      name: villageName,
      owner: this.user.uid,
      villageCode: villageCode, // Store the short code
      // Use a map for members to store extra data like house choice
      members: {
        [this.user.uid]: { joined: new Date() }
      },
    });

    await updateDoc(doc(this.db, "users", this.user.uid), { villages: arrayUnion(villageId) });    
    this.scene.start("HouseCustomizationScene", { villageId: villageId });
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