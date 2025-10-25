import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

let app;

const initialize = fetch('/api/firebase-config')
  .then(response => response.json())
  .then(firebaseConfig => {
    app = initializeApp(firebaseConfig);
    return app;
  });

function getDb() {
    if (!app) throw new Error("Firebase not initialized");
    return getFirestore(app);
}

function getAuthInstance() {
    if (!app) throw new Error("Firebase not initialized");
    return getAuth(app);
}


export { initialize, getDb, getAuthInstance };
