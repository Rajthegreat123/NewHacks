import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

function getDb() {
    if (!app) throw new Error("Firebase not initialized");
    return getFirestore(app);
}

function getAuthInstance() {
    if (!app) throw new Error("Firebase not initialized");
    return getAuth(app);
}

function getRealtimeDb() {
    if (!app) throw new Error("Firebase not initialized");
    return getDatabase(app);
}


export { app, getDb, getAuthInstance, getRealtimeDb};
