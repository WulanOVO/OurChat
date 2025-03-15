const WebSocket = require('ws');
const connect = require('../db/connection');
const handleJoin = require('./handlers/join');
const handleMessage = require('./handlers/message');
const handleRead = require('./handlers/read');
const setupHeartbeat = require('./utils/heartbeat');

async function init(server) {
  const wsPath = process.env.WS_PATH || '/ws';
  const wss = new WebSocket.Server({ server, path: wsPath });
  console.log('WebSocket 服务已启动');

  const db = await connect();
  const dbRooms = db.collection('rooms');
  const dbMessages = db.collection('messages');

  // 存储在线用户的WebSocket连接
  const users = new Map();

  wss.on('connection', async (ws) => {
    setupHeartbeat(ws);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
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
          type: 'error',
          message: '服务器内部错误'
        }));
      }
    });

    ws.on('close', () => {
      users.delete(ws);
    });
  });
}

module.exports = init;