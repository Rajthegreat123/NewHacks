import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // TODO: Replace the following with your app's Firebase project configuration
  apiKey: "AIzaSyDQjGF_pI6SxFJZgVmRroVsMI3A31UWFxM", // Replace with your API key
  authDomain: "village-game-a988b.firebaseapp.com", // Replace with your auth domain
  projectId: "village-game-a988b", // Replace with your project ID
  storageBucket: "village-game-a988b.firebasestorage.app", // Replace with your storage bucket
  messagingSenderId: "723653570059", // Replace with your messaging sender ID
  appId: "1:723653570059:web:af3576c2507d0ac8b4610e" // Replace with your app ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
const db = getFirestore(app);
const auth = getAuth(app);
const database = getDatabase(app);

export { app, db, auth, database };
