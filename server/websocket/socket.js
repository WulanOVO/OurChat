const WebSocket = require('ws');
const { db } = require('../db/connection');
const wsOnJoin = require('./handlers/join');
const wsOnMessage = require('./handlers/message');
const wsOnRead = require('./handlers/read');
const wsOnClose = require('./handlers/close');

async function init(server) {
  const wsPath = process.env.WS_PATH;
  const wss = new WebSocket.Server({ server, path: wsPath });
  console.log('WebSocket 服务已启动');

  const users = new Map();

  wss.on('connection', async (ws) => {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'join':
            await wsOnJoin(ws, data, users);
            break;

          case 'message':
            await wsOnMessage(ws, data, users);
            break;

          case 'read':
            await wsOnRead(ws, data, users);
            break;
        }
      } catch (err) {
        console.error('WebSocket错误:', err);
        ws.send(
          JSON.stringify({
            event: 'error',
            message: '服务器内部错误',
          })
        );
      }
    });

    ws.on('close', () => {
      wsOnClose(ws, users);
    });
  });
}

module.exports = init;
