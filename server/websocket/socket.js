const WebSocket = require('ws');
const { verifyToken } = require('../utils/token');
const connect = require('../db/connection');

async function init(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });
  console.log('WebSocket 服务已启动');

  const db = await connect();
  const dbRooms = db.collection('rooms');
  const dbMessages = db.collection('messages');

  // 存储在线用户的WebSocket连接
  const users = new Map();

  wss.on('connection', async (ws) => {
    let heartbeatInterval;

    // 设置心跳检测
    const startHeartbeat = () => {
      clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);
    };

    startHeartbeat();

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'join':
            const { token } = data;
            const decoded = verifyToken(token);
            if (!decoded) {
              ws.send(JSON.stringify({ type: 'error', message: '未授权的访问' }));
              ws.close();
              return;
            }

            const { rid } = data;
            const room = await dbRooms.findOne({ rid });

            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
              ws.close();
              return;
            }

            const userData = room.members.find(member => member.uid === decoded.uid);

            if (!userData) {
              ws.send(JSON.stringify({ type: 'error', message: '你没有权限进入该房间' }));
              ws.close();
              return;
            }

            users.set(ws, { rid, ...userData });

            // 发送用户信息和房间信息
            ws.send(JSON.stringify({
              type: 'user',
              user: userData,
              roomData: {
                rid: room.rid,
                name: room.name,
                members: room.members
              }
            }));

            const messages = await dbMessages.find({ room: rid })
              .sort({ timestamp: -1 })
              .limit(50)
              .toArray();

            ws.send(JSON.stringify({
              type: 'history',
              messages: messages.map(({ _id, ...rest }) => rest).reverse()
            }));
            break;

          case 'message':
            const user = users.get(ws);
            if (!user) {
              ws.send(JSON.stringify({ type: 'error', message: '请先加入房间' }));
              return;
            }

            // 消息格式验证
            if (!data.content || typeof data.content !== 'string') {
              ws.send(JSON.stringify({ type: 'error', message: '消息格式不正确' }));
              return;
            }

            if (data.content.length > 1000) {
              ws.send(JSON.stringify({ type: 'error', message: '消息长度不能超过1000字符' }));
              return;
            }

            const newMessage = {
              room: user.rid,
              sender: user.uid,
              content: data.content.trim(),
              content_type: 'text',
              timestamp: new Date(),
              read_by: [user.uid]
            };

            const result = await dbMessages.insertOne(newMessage);

            if (!result.acknowledged) {
              ws.send(JSON.stringify({ type: 'error', message: '消息发送失败' }));
              return;
            }

            // 广播消息给同一房间的所有用户
            const { _id, ...messageWithoutId } = newMessage;
            for (const [client, clientUser] of users.entries()) {
              if (clientUser.rid === user.rid && client.readyState === WebSocket.OPEN) {
                try {
                  client.send(JSON.stringify({
                    type: 'chat',
                    ...messageWithoutId
                  }));
                } catch (err) {
                  console.error('发送消息失败:', err);
                }
              }
            }
            break;

          case 'read':
            const reader = users.get(ws);
            if (!reader) {
              ws.send(JSON.stringify({ type: 'error', message: '请先加入房间' }));
              return;
            }

            const updateResult = await dbMessages.updateMany(
              {
                room: reader.rid,
                timestamp: { $lte: new Date(data.timestamp) },
                read_by: { $ne: reader.uid }
              },
              {
                $addToSet: { read_by: reader.uid }
              }
            );

            if (updateResult.modifiedCount > 0) {
              // 获取更新后的消息
              const updatedMessages = await dbMessages.find({
                room: reader.rid,
                timestamp: { $lte: new Date(data.timestamp) }
              }).toArray();

              // 广播已读状态更新
              for (const [client, clientUser] of users.entries()) {
                if (clientUser.rid === reader.rid && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'read_status_update',
                    messages: updatedMessages.map(msg => ({
                      timestamp: msg.timestamp,
                      read_by: msg.read_by
                    }))
                  }));
                }
              }
            }
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

    // 处理心跳响应
    ws.on('pong', () => {
      startHeartbeat();
    });

    // 处理连接断开
    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      users.delete(ws);
    });
  });
}

module.exports = init;