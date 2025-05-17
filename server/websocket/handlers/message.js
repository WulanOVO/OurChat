const WebSocket = require('ws');
const { db } = require('../../db/connection');
const { validate } = require('../../utils/ajv');

const dbMessages = db.collection('messages');

async function handleMessage(ws, data, users) {
  const user = users.get(ws);
  if (!user) {
    ws.send(JSON.stringify({ action: 'error', message: '请先加入房间' }));
    return;
  }

  const valid = validate(data, {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['text', 'file', 'image', 'video'] },
      content: { type: 'string' },
    },
    required: ['type', 'content'],
  });

  if (!valid) {
    ws.send(JSON.stringify({ action: 'error', message: '消息格式不正确' }));
    return;
  }

  const { type, content } = data;

  if (!content || typeof content !== 'string') {
    ws.send(JSON.stringify({ action: 'error', message: '消息格式不正确' }));
    return;
  }

  if (content.length > 1000) {
    ws.send(
      JSON.stringify({ action: 'error', message: '消息长度不能超过1000字符' })
    );
    return;
  }

  const newMessage = {
    roomId: user.rid,
    senderId: user.uid,
    content: content.trim(),
    type,
    createdAt: new Date(),
    readBy: [user.uid],
  };

  const result = await dbMessages.insertOne(newMessage);

  if (!result.acknowledged) {
    ws.send(JSON.stringify({ action: 'error', message: '消息发送失败' }));
    return;
  }

  const messageData = {
    ...newMessage,
    createdAt: Math.floor(newMessage.createdAt.getTime() / 1000),
  };
  delete messageData._id;
  delete messageData.room;

  for (const [client, clientUser] of users.entries()) {
    if (clientUser.rid === user.rid && client.readyState === WebSocket.OPEN) {
      try {
        client.send(
          JSON.stringify({
            action: 'chat',
            data: messageData,
          })
        );
      } catch (err) {
        console.error('发送消息失败:', err);
      }
    }
  }
}

module.exports = handleMessage;
