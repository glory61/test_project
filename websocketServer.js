const WebSocket = require('ws');

// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Store connected clients
const connectedClients = new Set();

wss.on('connection', (ws) => {
    // Add client to connected clients set
    connectedClients.add(ws);
    console.log('A client has connected');

    // Remove client from connected clients set on close event
    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log('A client has disconnected');
    });
});
function handleUpgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
}

// Export WebSocket server and connected clients set
module.exports = {connectedClients,handleUpgrade };
