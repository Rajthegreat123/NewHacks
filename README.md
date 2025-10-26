# Commune

A multiplayer 2D side-scroller game built with Phaser, Firebase, and Node.js. Players can join villages, customize their avatars and houses, and interact with other players in real-time.

## Features

-   Real-time multiplayer gameplay using Firebase Realtime Database.
-   Persistent player data (users, villages, houses) with Firestore.
-   Player authentication with Firebase Auth.
-   In-game bulletin boards for players to leave messages.
-   Customizable player avatars and houses.
-   Interactive elements within player houses, like a simple planting/gardening mechanic.

## Technologies Used

-   **Game Engine**: [Phaser 3](https://phaser.io/)
-   **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/)
-   **Database & Auth**: [Firebase](https://firebase.google.com/) (Authentication, Firestore, Realtime Database)
-   **Hosting/Deployment**: The server is set up to serve the static client files.

## Prerequisites

-   [Node.js and npm](https://nodejs.org/) (LTS version recommended)
-   A [Firebase](https://firebase.google.com/) account

## Setup and Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Rajthegreat123/NewHacks.git
    cd NewHacks
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up Firebase:**

    a. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.

    b. In your new project, enable the following services:
        -   **Authentication**: Go to the `Authentication` section, click `Get started`, and enable the **Email/Password** sign-in provider.
        -   **Firestore Database**: Go to the `Firestore Database` section, click `Create database`, and start in **test mode** for easy setup.
        -   **Realtime Database**: Go to the `Realtime Database` section, click `Create Database`, and start in **test mode**.

    c. Get your Firebase configuration credentials:
        -   Go to your Project's `Settings` (click the gear icon ⚙️ next to `Project Overview`).
        -   In the `General` tab, scroll down to `Your apps`.
        -   Click the web icon (`</>`) to create a new web app.
        -   Give it a nickname (e.g., "Commune") and register the app.
        -   Firebase will provide you with a `firebaseConfig` object. You will need these values.

4.  **Create an environment file:**

    a. In the root directory of the project, create a file named `.env`.

    b. Copy the keys and values from the `firebaseConfig` object into the `.env` file in the following format:

    ```env
    VITE_FIREBASE_API_KEY="your-api-key"
    VITE_FIREBASE_AUTH_DOMAIN="your-auth-domain"
    VITE_FIREBASE_PROJECT_ID="your-project-id"
    VITE_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
    VITE_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
    VITE_FIREBASE_APP_ID="your-app-id"
    ```

    > **Note:** The server uses these environment variables to securely provide the configuration to the client-side application.

## Running the Commune

1.  **Start the server:**

    ```bash
    npm start
    ```

2.  **Open the Commune:**

    Open your web browser and navigate to `http://localhost:8080`. You should see the login/signup screen for the Commune.