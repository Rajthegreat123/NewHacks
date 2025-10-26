import * as Phaser from "phaser";
import { getAuthInstance, getDb } from "../firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    console.log("MenuScene create method called");

    // add logo at top of UI
    const logo = document.createElement('img');
    logo.id = 'ui-logo';
    logo.src = 'assets/Title.png'; // adjust filename if different
    logo.alt = 'Title';
    logo.style.display = 'block';
    logo.style.margin = '0 auto 12px';
    logo.style.width = '320px';       // tweak to fit your layout (use integer multiples for pixel art)
    logo.style.imageRendering = 'pixelated';
    const ui = document.getElementById("ui");
    ui.prepend(logo);

    ui.style.display = "block";

    this.cameras.main.setBackgroundColor("#7a4841");

    ui.style.display = "block";

    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const showSignup = document.getElementById("show-signup");
    const showLogin = document.getElementById("show-login");

    showSignup.addEventListener("click", (e) => {
      e.preventDefault();
      loginForm.style.display = "none";
      signupForm.style.display = "block";
    });

    showLogin.addEventListener("click", (e) => {
      e.preventDefault();
      signupForm.style.display = "none";
      loginForm.style.display = "block";
    });

    const signupButton = document.getElementById("signup-button");
    signupButton.addEventListener("click", async () => {
      const username = document.getElementById("signup-username").value;
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
      const confirmPassword = document.getElementById("signup-confirm-password").value;

      if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }

      try {
        const auth = getAuthInstance();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const db = getDb();
        await setDoc(doc(db, "users", userCredential.user.uid), {
          username: username,
          email: email
        });
        ui.style.display = "none";
        this.scene.start("AvatarCustomizationScene");
      } catch (error) {
        alert(error.message);
      }
    });

    const loginButton = document.getElementById("login-button");
    loginButton.addEventListener("click", async () => {
      const usernameOrEmail = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      const auth = getAuthInstance();

      try {
        let email = usernameOrEmail;
        if (!email.includes("@")) {
          const db = getDb();
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("username", "==", usernameOrEmail));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            alert("Invalid username or password");
            return;
          }
          email = querySnapshot.docs[0].data().email;
        }

        await signInWithEmailAndPassword(auth, email, password);
        ui.style.display = "none";
        this.scene.start("VillageLobbyScene");
      } catch (error) {
        alert("Invalid username or password");
      }
    });
  }
}
