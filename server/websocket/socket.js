const WebSocket = require('ws');
const connect = require('../db/connection');
const handleJoin = require('./handlers/join');
const handleMessage = require('./handlers/message');
const handleRead = require('./handlers/read');

async function init(server) {
  const wsPath = process.env.WS_PATH || '/ws';
  const wss = new WebSocket.Server({ server, path: wsPath });
  console.log('WebSocket 服务已启动');

  const db = await connect();
  const dbRooms = db.collection('rooms');
  const dbMessages = db.collection('messages');

  const users = new Map();
  const roomUsers = new Map();

  wss.on('connection', async (ws) => {
    let userData = null;
    let currentRoom = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.action) {
          case 'join':
            await handleJoin(ws, data, dbRooms, dbMessages, users);
            break;

          case 'message':
            await handleMessage(ws, data, users, dbMessages);
            break;

          case 'read':
            await handleRead(ws, data, users, dbMessages);
            break;
        }
      } catch (err) {
        console.error('WebSocket错误:', err);
        ws.send(JSON.stringify({
          action: 'error',
          message: '服务器内部错误'
        }));
      }
    });

    ws.on('close', () => {
      if (userData && currentRoom) {
        if (roomUsers.has(currentRoom)) {
          roomUsers.get(currentRoom).delete(userData.uid);

          if (roomUsers.get(currentRoom).size === 0) {
            roomUsers.delete(currentRoom);
          }
        }

        broadcastUserStatus(currentRoom, userData.uid, false, users, roomUsers);
      }

      users.delete(ws);
    });
  });

  function broadcastUserStatus(roomId, userId, isOnline, users, roomUsers) {
    if (!roomUsers.has(roomId)) return;

    for (const [ws, user] of users.entries()) {
      if (user.uid === userId) continue;

      if (user.rid === roomId) {
        ws.send(JSON.stringify({
          action: 'userStatus',
          data: {
            uid: userId,
            online: isOnline
          }
        }));
      }
    }
  }
}

module.exports = init;