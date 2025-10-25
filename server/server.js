import express from "express";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from 'uuid';
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

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () =>
  console.log(`HTTP and WebSocket server on http://localhost:${PORT}`)
);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  ws.id = uuidv4(); // Assign a unique ID to each connection

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "joinVillage") {
      const { villageId } = data;
      if (!villages[villageId]) villages[villageId] = {};
      
      // Clean up old connection if any
      if(ws.villageId && villages[ws.villageId] && villages[ws.villageId][ws.id]) {
        delete villages[ws.villageId][ws.id];
        broadcast(ws.villageId);
      }

      ws.villageId = villageId;
      villages[villageId][ws.id] = { x: 100, y: 400 }; // Default position
      broadcast(villageId);
    }
    if (data.type === "move") {
      const { villageId, x, y } = data;
      if (!villages[villageId] || !villages[villageId][ws.id]) return;
      villages[villageId][ws.id] = { x, y };
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
    if (client.villageId === villageId && client.readyState === client.OPEN)
      client.send(payload);
  });
}
