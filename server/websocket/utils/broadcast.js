function broadcast(event, data, broadcastUser, users, config) {
  for (const [client, clientUser] of users.entries()) {
    if (
      clientUser.roomId === broadcastUser.roomId &&
      client.readyState === WebSocket.OPEN
    ) {
      if (config?.excludeSelf && clientUser.uid === broadcastUser.uid) {
        continue;
      }
      client.send(JSON.stringify({ event, data }));
    }
  }
}

module.exports = broadcast;
