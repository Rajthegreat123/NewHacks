import { EventEmitter } from '../../node_modules/eventemitter3/dist/eventemitter3.esm.js';

export const socket = new WebSocket("ws://localhost:8080");

class SocketEmitter extends EventEmitter {}
export const socketEmitter = new SocketEmitter();

socket.emit = (type, data) => {
  socket.send(JSON.stringify({ type, ...data }));
};

socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    socketEmitter.emit(data.type, data); // Emit an event with the message type
  } catch (error) {
    console.error("Error parsing WebSocket message:", error);
  }
};
