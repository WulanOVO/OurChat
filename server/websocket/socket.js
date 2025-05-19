const WebSocket = require('ws');
const { db } = require('../db/connection');
const handleJoin = require('./handlers/join');
const handleMessage = require('./handlers/message');
const handleRead = require('./handlers/read');

async function init(server) {
  const wsPath = process.env.WS_PATH;
  const wss = new WebSocket.Server({ server, path: wsPath });
  console.log('WebSocket 服务已启动');

  const users = new Map();

  wss.on('connection', async (ws) => {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.action) {
          case 'join':
            await handleJoin(ws, data, users);
            break;

          case 'message':
            await handleMessage(ws, data, users);
            break;

          case 'read':
            await handleRead(ws, data, users);
            break;
        }
      } catch (err) {
        console.error('WebSocket错误:', err);
        ws.send(
          JSON.stringify({
            action: 'error',
            message: '服务器内部错误',
          })
        );
      }
    });
  });
}

module.exports = init;
