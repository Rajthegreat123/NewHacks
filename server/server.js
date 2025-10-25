import express from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, "..")));

app.get("/api/firebase-config", (req, res) => {
  res.json({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });
});

let villages = {}; // { villageId: { playerId: {x, y} } }

const server = app.listen(8080, () =>
  console.log("HTTP and WebSocket server on http://localhost:8080")
);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "joinVillage") {
      const { villageId } = data;
      if (!villages[villageId]) villages[villageId] = {};
      ws.villageId = villageId;
    }
    if (data.type === "move") {
      const { villageId, x, y } = data;
      if (!villages[villageId]) return;
      villages[villageId][ws._socket.remotePort] = { x, y };
      broadcast(villageId);
    }
  });
});

function broadcast(villageId) {
  const payload = JSON.stringify({
    type: "playerUpdate",
    players: villages[villageId],
  });
  wss.clients.forEach((client) => {
    if (client.villageId === villageId && client.readyState === 1)
      client.send(payload);
  });
}
