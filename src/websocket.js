export const socket = new WebSocket("ws://localhost:8080");

socket.emit = (type, data) => {
  socket.send(JSON.stringify({ type, ...data }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "playerUpdate") {
    console.log("Players:", data.players);
  }
};
