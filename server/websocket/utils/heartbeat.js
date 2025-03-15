function setupHeartbeat(ws) {
  let heartbeatInterval;

  const startHeartbeat = () => {
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);
  };

  ws.on('pong', () => {
    startHeartbeat();
  });

  ws.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  startHeartbeat();
}

module.exports = setupHeartbeat;